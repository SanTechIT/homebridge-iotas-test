import {
  API,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
  CharacteristicGetCallback,
  CharacteristicValue,
  CharacteristicSetCallback,
  WithUUID,
} from "homebridge";

import _axios from "axios";
import jwt_decode from "jwt-decode";

const PLUGIN_NAME = "homebridge-iotas";
const PLATFORM_NAME = "homebridge-iotas";

export = (api: API) => {
  api.registerPlatform(PLUGIN_NAME, HomebridgeIotas as any);
};

const IOTAS_URL = "https://api.iotashome.com/api/v1";

const axios = _axios.create({
  baseURL: IOTAS_URL,
});

interface Config extends PlatformConfig {
  username: string;
  password: string;
}

type Rooms = Room[];

interface Room {
  id: number;
  unit: number;
  name: string;
  devices: Device[];
}

interface Device {
  id: number;
  room: number;
  unit: number;
  deviceTemplateId: number;
  deviceType: number;
  name: string;
  category: string;
  active: boolean;
  movable: boolean;
  secure: boolean;
  paired: boolean;
  serialNumber: string;
  features: Feature[];
}

interface Feature {
  id: number;
  device: number;
  eventType: number;
  eventTypeName: string;
  featureType: number;
  featureTypeName: string;
  featureTypeCategory: string;
  featureTypeSettable: boolean;
  name: string;
  value: number;
  values?: string;
}

interface Residency {
  id: string;
  accountId: number;
  unit: number;
  buildingId: number;
  unitName: string;
  dateFrom: string;
  tenant: boolean;
  unitAdmin: boolean;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  suspended: boolean;
  account: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    hasPassword: boolean;
  };
}

function cToF(c: any) {
  return (Number(c) * 9) / 5 + 32;
}

function fToC(f: any) {
  return ((Number(f) - 32) * 5) / 9;
}

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
class HomebridgeIotas {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  token: string | null = null;
  refreshToken = "";
  authenticateRequest: Promise<string | void> | null = null;
  unitRequest: Promise<Rooms> | null = null;
  unit: number = 0;

  lastUpdatedBrightness: { [key: string]: number } = {};

  constructor(
    public readonly log: Logger,
    public readonly config: Config,
    public readonly api: API
  ) {
    this.log.debug("Finished initializing platform:", this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on("didFinishLaunching", () => {
      log.debug("Executed didFinishLaunching callback");
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  getUnit() {
    return this.withAuth().then((api) => {
      if (this.unitRequest === null) {
        this.unitRequest = api
          .get("unit/" + this.unit + "/rooms")
          .then((response) => response.data as Rooms);
        this.unitRequest.then(() => (this.unitRequest = null));
      }
      return this.unitRequest;
    });
  }

  getFeature(featureId: string) {
    return this.getUnit().then((rooms) => {
      for (const room of rooms) {
        for (const device of room.devices) {
          for (const feature of device.features) {
            if (feature.id.toString() === featureId) return feature;
          }
        }
      }
      return {
        value: 0,
      };
    });
  }

  updateFeature(featureId: string, value: CharacteristicValue) {
    let body = {
      value: value,
    };
    return this.withAuth().then((api) =>
      api.put(`/feature/${featureId}`, body).then((response) => {
        return response.data;
      })
    );
  }

  getCharacteristic(
    featureId: string,
    format: null | ((value: number) => CharacteristicValue),
    next: CharacteristicGetCallback
  ) {
    this.getFeature(featureId)
      .then((res) => {
        return next(null, format === null ? res.value : format(res.value));
      })
      .catch((err) => {
        this.log.error("error getting value for feature", featureId, format);
        this.log.error(err.toString());
        return next(err);
      });
  }

  setCharacteristic(
    featureId: string,
    format: null | ((value: CharacteristicValue) => number),
    value: CharacteristicValue,
    next: CharacteristicSetCallback
  ) {
    this.updateFeature(featureId, format === null ? value : format(value))
      .then((res) => {
        return next();
      })
      .catch((err) => {
        this.log.error("error setting value for feature ", featureId, format);
        this.log.error(err.toString());
        return next(err);
      });
  }

  initServices(accessory: PlatformAccessory) {
    accessory
      .getService(this.Service.AccessoryInformation)!!
      .setCharacteristic(this.Characteristic.Manufacturer, "IOTAS")
      .setCharacteristic(this.Characteristic.Model, "switch")
      .setCharacteristic(this.Characteristic.SerialNumber, "123-456-789");

    const device = accessory.context as Device;

    const services = new Set();

    for (const feature of device.features ?? []) {
      if (
        !feature.featureTypeSettable &&
        !["current_temperature", "battery"].includes(
          feature.featureTypeCategory
        )
      )
        continue;
      if (
        feature.eventTypeName === "OnOff" &&
        ["Lock", "Light", "Operation Mode"].includes(feature.featureTypeName)
      ) {
        let service = accessory.getService(this.Service.Switch);
        if (typeof service === "undefined") {
          service = new this.Service.Switch(accessory.displayName);
          accessory.addService(service);
        }
        services.add(service);
        service
          .getCharacteristic(this.Characteristic.On)
          .on(
            "get",
            this.getCharacteristic.bind(
              this,
              feature.id.toString(),
              (value: number) => value === 1
            )
          )
          .on(
            "set",
            this.setCharacteristic.bind(this, feature.id.toString(), (v) =>
              Number(v)
            )
          );
      } else if (
        feature.eventTypeName === "Level" &&
        feature.featureTypeCategory === "light"
      ) {
        let service = accessory.getService(this.Service.Lightbulb);
        if (typeof service === "undefined") {
          service = new this.Service.Lightbulb(accessory.displayName);
          accessory.addService(service);
        }
        services.add(service);
        service
          .getCharacteristic(this.Characteristic.Brightness)
          .on(
            "get",
            this.getCharacteristic.bind(
              this,
              feature.id.toString(),
              (v) => v * 100
            )
          )
          .on(
            "set",
            (
              newValue: CharacteristicValue,
              next: CharacteristicSetCallback
            ) => {
              this.lastUpdatedBrightness[accessory.UUID] = Date.now();
              this.setCharacteristic(
                feature.id.toString(),
                null,
                Number(newValue) / 100,
                next
              );
            }
          );
        service
          .getCharacteristic(this.Characteristic.On)
          .on(
            "get",
            this.getCharacteristic.bind(
              this,
              feature.id.toString(),
              (v) => v > 0
            )
          )
          .on(
            "set",
            (
              newValue: CharacteristicValue,
              next: CharacteristicSetCallback
            ) => {
              setTimeout(() => {
                if (
                  newValue === 0 ||
                  Date.now() -
                    (this.lastUpdatedBrightness[accessory.UUID] || 0) >
                    150
                ) {
                  this.setCharacteristic(
                    feature.id.toString(),
                    null,
                    Number(newValue) / 100,
                    () => {
                      service?.updateCharacteristic(
                        this.Characteristic.Brightness,
                        Number(newValue) * 100
                      );
                      next();
                    }
                  );
                } else {
                  next();
                }
              }, 50);
            }
          );
      } else if (feature.eventTypeName === "Temperature") {
        let service = accessory.getService(this.Service.Thermostat);
        if (typeof service === "undefined") {
          service = new this.Service.Thermostat(accessory.displayName);
          accessory.addService(service);
        }
        services.add(service);
        if (feature.featureTypeCategory === "current_temperature") {
          service
            .getCharacteristic(this.Characteristic.CurrentTemperature)
            .on(
              "get",
              this.getCharacteristic.bind(this, feature.id.toString(), fToC)
            );
        }
        if (feature.featureTypeCategory === "heat_set_point") {
          service
            .getCharacteristic(this.Characteristic.HeatingThresholdTemperature)
            .on(
              "get",
              this.getCharacteristic.bind(this, feature.id.toString(), fToC)
            )
            .on(
              "set",
              this.setCharacteristic.bind(this, feature.id.toString(), cToF)
            );
        }
        if (feature.featureTypeCategory === "cool_set_point") {
          service
            .getCharacteristic(this.Characteristic.CoolingThresholdTemperature)
            .on(
              "get",
              this.getCharacteristic.bind(this, feature.id.toString(), fToC)
            )
            .on(
              "set",
              this.setCharacteristic.bind(this, feature.id.toString(), cToF)
            );
          const tempCats = ["cool_set_point", "heat_set_point"];
          if (tempCats.includes(feature.featureTypeCategory)) {
            const features = tempCats.reduce((acc, cur) => {
              const feature = device.features.find(
                (feature) => feature.featureTypeCategory === cur
              );
              if (feature !== undefined) {
                acc[cur] = feature;
              }
              return acc;
            }, {} as Record<string, Feature>);
            service
              .getCharacteristic(this.Characteristic.TargetTemperature)
              .on("get", (next: CharacteristicGetCallback) => {
                const modeFeature = device.features.find(
                  (feature) => feature.featureTypeCategory === "thermostat_mode"
                )!!;
                this.getCharacteristic(
                  modeFeature.id.toString(),
                  null,
                  (_: any, value: any) => {
                    const mode = (
                      modeFeature.values?.split(":")?.[Number(value)] ?? ""
                    ).toLowerCase();
                    if (mode.includes("cool")) {
                      this.getCharacteristic(
                        features["cool_set_point"].id.toString(),
                        fToC,
                        next
                      );
                    } else if (mode.includes("heat")) {
                      this.getCharacteristic(
                        features["heat_set_point"].id.toString(),
                        fToC,
                        next
                      );
                    } else {
                      this.getCharacteristic(
                        features["cool_set_point"].id.toString(),
                        fToC,
                        (_: any, cool: any) => {
                          this.getCharacteristic(
                            features["heat_set_point"].id.toString(),
                            fToC,
                            (_: any, heat: any) =>
                              next(null, (Number(heat) + Number(cool)) / 2)
                          );
                        }
                      );
                    }
                  }
                );
              })
              .on(
                "set",
                (
                  newValue: CharacteristicValue,
                  next: CharacteristicSetCallback
                ) => {
                  const modeFeature = device.features.find(
                    (feature) =>
                      feature.featureTypeCategory === "thermostat_mode"
                  )!!;
                  this.getCharacteristic(
                    modeFeature.id.toString(),
                    null,
                    (_: any, value: any) => {
                      const mode = (
                        modeFeature.values?.split(":")?.[Number(value)] ?? ""
                      ).toLowerCase();
                      if (mode.includes("cool")) {
                        this.setCharacteristic(
                          features["cool_set_point"].id.toString(),
                          cToF,
                          newValue,
                          next
                        );
                      } else if (mode.includes("heat")) {
                        this.setCharacteristic(
                          features["heat_set_point"].id.toString(),
                          cToF,
                          newValue,
                          next
                        );
                      } else {
                        next();
                      }
                    }
                  );
                }
              );
          }
        }
      } else if (feature.eventTypeName === "ThermostatMode") {
        let service = accessory.getService(this.Service.Thermostat);
        if (typeof service === "undefined") {
          service = new this.Service.Thermostat(accessory.displayName);
          accessory.addService(service);
        }
        services.add(service);
        const split = feature.values?.split(":") ?? [];
        const states = split.map((state) => {
          const s = state.toLowerCase();
          if (s.includes("heat")) {
            return this.Characteristic.TargetHeatingCoolingState.HEAT;
          } else if (s.includes("cool")) {
            return this.Characteristic.TargetHeatingCoolingState.COOL;
          } else if (s.includes("off")) {
            return this.Characteristic.TargetHeatingCoolingState.OFF;
          } else {
            return this.Characteristic.TargetHeatingCoolingState.AUTO;
          }
        });
        service
          .getCharacteristic(this.Characteristic.TargetHeatingCoolingState)
          .on(
            "get",
            this.getCharacteristic.bind(
              this,
              feature.id.toString(),
              (value: number) => states[value]
            )
          )
          .on(
            "set",
            this.setCharacteristic.bind(
              this,
              feature.id.toString(),
              (v) =>
                ({
                  [this.Characteristic.TargetHeatingCoolingState.HEAT.toString()]:
                    split.indexOf("Heat"),
                  [this.Characteristic.TargetHeatingCoolingState.COOL.toString()]:
                    split.indexOf("Cool"),
                  [this.Characteristic.TargetHeatingCoolingState.OFF.toString()]:
                    split.indexOf("Off"),
                  [this.Characteristic.TargetHeatingCoolingState.AUTO.toString()]:
                    split.indexOf("Auto"),
                }[v.toString()])
            )
          );
      } else if (feature.featureTypeName === "Battery") {
        let service = accessory.getService(this.Service.BatteryService);
        if (typeof service === "undefined") {
          service = new this.Service.BatteryService(accessory.displayName);
          accessory.addService(service);
        }
        services.add(service);
        service
          .getCharacteristic(this.Characteristic.BatteryLevel)
          .on(
            "get",
            this.getCharacteristic.bind(this, feature.id.toString(), null)
          );
      }
    }
    for (const service of accessory.services) {
      if (
        [this.Service.Switch, this.Service.Lightbulb].some(
          (svcType) => service instanceof svcType
        ) &&
        !services.has(service)
      ) {
        accessory.removeService(service);
      }
    }
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info("Loading accessory from cache:", accessory.displayName);

    this.initServices(accessory);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  tryAddDevice(roomName: string, device: Device) {
    if (
      !device.features.some(
        (feature) =>
          ["Temperature", "OnOff", "Level", "ThermostatMode"].includes(
            feature.eventTypeName
          ) &&
          (feature.featureTypeSettable ||
            feature.featureTypeCategory === "current_temperature")
      )
    )
      return null;

    const uuid = this.api.hap.uuid.generate(device.id.toString());
    const name = roomName + " " + device.name;

    const existingAccessory = this.accessories.find(
      (accessory) => accessory.UUID === uuid
    );

    // check the accessory was not restored from cache
    if (!existingAccessory) {
      // create a new accessory
      const accessory = new this.api.platformAccessory(name, uuid);
      accessory.context = device;

      this.log.info("Adding new accessory:", name);

      this.initServices(accessory);

      this.accessories.push(accessory);

      // register the accessory
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
        accessory,
      ]);
    } else {
      existingAccessory.context = device;
      this.log.info("Updating accessory:", name);
      this.api.updatePlatformAccessories([existingAccessory]);
    }

    return device.id;
  }

  discoverDevices() {
    this.withAuth().then((api) => {
      api.get("unit/" + this.unit + "/rooms").then((response) => {
        const rooms = response.data as Rooms;
        const deviceIds = rooms.map((room) =>
          room.devices.map(this.tryAddDevice.bind(this, room.name))
        );
        this.accessories.forEach((accessory) => {
          if (
            !deviceIds.some((ids) =>
              ids.some((id) => id === accessory.context.id)
            )
          ) {
            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
              accessory,
            ]);
          }
        });
      });
    });
  }

  withAuth() {
    return this.getToken()
      .then((token) =>
        _axios.create({
          baseURL: IOTAS_URL,
          headers: {
            Authorization: "Bearer " + token,
          },
          validateStatus: (status) => {
            if (status === 401) {
              this.token = null;
            }
            return status >= 200 && status < 300;
          },
        })
      )
      .then((api) => {
        if (this.unit !== 0) return api;
        else
          return api.get("/account/me").then((response) => {
            const accountId = response.data.id;
            this.log.info("Found account id " + accountId);
            return api
              .get("/account/" + accountId + "/residency")
              .then((response: { data: Residency[] }) => {
                if (response.data.length > 0) {
                  console.log(
                    "Found unit(s) ",
                    response.data.map((unit) => unit.unitName)
                  );
                  if (this.config.unit != null) {
                    const customUnit = response.data.find(
                      (unit) => unit.unitName === this.config.unit
                    )?.unit;
                    if (customUnit != null) {
                      this.unit = customUnit;
                      this.log.info("Using custom unit ", customUnit);
                      return api;
                    } else {
                      this.log.warn(
                        "Could not find unit ",
                        customUnit,
                        ", using default"
                      );
                    }
                  }
                  this.unit = response.data[0].unit;
                  this.log.info(
                    "Using first unit found: ",
                    this.unit,
                    '. If you would like to use a custom unit, please set the "unit" property in the config.'
                  );
                  return api;
                } else {
                  this.log.error("Unable to find any units. Abandoning...");
                  throw Error("Unable to find any units. Abandoning...");
                }
              });
          });
      });
  }

  getToken() {
    if (this.token === null) {
      return this.authenticate();
    }
    let decoded = jwt_decode(this.token) as any;
    let now = Date.now() / 1000;
    if (decoded.exp < now) {
      return this.authenticate();
    } else {
      return Promise.resolve(this.token);
    }
  }

  refreshAccessToken() {
    let body = {
      refresh: this.refreshToken,
      email: this.config.username,
    };
    if (this.authenticateRequest === null) {
      this.authenticateRequest = axios
        .post(`/auth/refresh`, body)
        .then((response) => {
          this.token = response.data.jwt as string;
          return this.token;
        })
        .catch((error) => {
          console.log("error: ");
          console.log(error);
        });
      this.authenticateRequest.finally(() => (this.authenticateRequest = null));
    }
    return this.authenticateRequest;
  }

  authenticate() {
    let config = {
      auth: {
        username: this.config.username,
        password: this.config.password,
      },
    };
    if (this.authenticateRequest === null) {
      this.authenticateRequest = axios
        .post(`/auth/tokenwithrefresh`, {}, config)
        .then((response) => {
          this.refreshToken = response.data.refresh;
          this.token = response.data.jwt;
          return this.token as string;
        })
        .catch((error) => {
          console.log("error: ");
          console.log(error);
          console.log("Trying again in 10 minutes...");
          setTimeout(() => this.authenticate(), 1000 * 60 * 10);
        });
      this.authenticateRequest.finally(() => (this.authenticateRequest = null));
    }
    return this.authenticateRequest;
  }
}
