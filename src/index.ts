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
  WithUUID
} from "homebridge";

import _axios from "axios";
import jwt_decode from "jwt-decode"

const PLUGIN_NAME = "homebridge-iotas";
const PLATFORM_NAME = "homebridge-iotas";

export = (api: API) => {
  api.registerPlatform(PLUGIN_NAME, HomebridgeIotas as any);
};

const IOTAS_URL = "https://api.iotashome.com/api/v1";

const axios = _axios.create({
  baseURL: IOTAS_URL
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
  name: string;
  value: number | boolean;
}

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
class HomebridgeIotas {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap
    .Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  token: string | null = null;
  refreshToken = "";

  lastUpdatedBrightness: {[key: string]: number} = {};

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

  getFeature(featureId: string) {
    return this.withAuth().then(api => 
      api.get("/feature/" + featureId)
      .then((response) => {
        return response.data as Feature;
      }));
  }
  
  updateFeature(featureId: string, value: CharacteristicValue) {
    let body = {
      value: value,
    };
    return this.withAuth().then(api => api
      .put(`/feature/${featureId}`, body)
      .then((response) => {
        return response.data;
      }));
  }

  getCharacteristic(isBoolean: boolean, scale100: boolean, featureId: string, next: CharacteristicGetCallback) {
    this.getFeature(featureId)
      .then((res) => {
        const value = scale100 ? Number(res.value) * 100 : Number(res.value);
        return next(null, isBoolean ? value > 0 : value);
      })
      .catch((err) => {
        this.log.error("error getting value");
        this.log.error(err.toString());
        return next(err);
      });
  }

  setCharacteristic(scale100: boolean, featureId: string, newValue: CharacteristicValue, next: CharacteristicSetCallback) {
    if (scale100) {
      newValue = Number(newValue) / 100;
    }
    let value = Number(newValue);

    this.updateFeature(featureId, value)
      .then((res) => {
        return next();
      })
      .catch((err) => {
        this.log.error("error setting value");
        this.log.error(err.toString());
        return next(err);
      });
  }

  initServices(accessory: PlatformAccessory) {

    accessory.getService(this.Service.AccessoryInformation)!!
      .setCharacteristic(this.Characteristic.Manufacturer, "IOTAS")
      .setCharacteristic(this.Characteristic.Model, "switch")
      .setCharacteristic(this.Characteristic.SerialNumber, "123-456-789");

    if (accessory.context.type === "OnOff") {
      let service = accessory.getService(this.Service.Switch);
      if (typeof service === "undefined") {
        service = new this.Service.Switch(accessory.displayName);
        accessory.addService(service);
      }
      service
        .getCharacteristic(this.Characteristic.On)
        .on("get", this.getCharacteristic.bind(this, true, false, accessory.context.featureId))
        .on("set", this.setCharacteristic.bind(this, false, accessory.context.featureId));
      const hasLightbulbService = accessory.getService(this.Service.Lightbulb);
      if (typeof hasLightbulbService !== "undefined") {
        accessory.removeService(hasLightbulbService);
      }
    } else if (accessory.context.type === "Level") {
      let service = accessory.getService(this.Service.Lightbulb);
      if (typeof service === "undefined") {
        service = new this.Service.Lightbulb(accessory.displayName);
        accessory.addService(service);
      }
      service
        .getCharacteristic(this.Characteristic.Brightness)
        .on("get", this.getCharacteristic.bind(this, false, true, accessory.context.featureId))
        .on("set", (newValue: CharacteristicValue, next: CharacteristicSetCallback) => {
          this.lastUpdatedBrightness[accessory.UUID] = Date.now();
          this.setCharacteristic(true, accessory.context.featureId, newValue, () => {
            service?.updateCharacteristic(this.Characteristic.Brightness, Number(newValue));
            next();
          });
        });
      service
        .getCharacteristic(this.Characteristic.On)
        .on("get", this.getCharacteristic.bind(this, true, true, accessory.context.featureId))
        .on("set", (newValue: CharacteristicValue, next: CharacteristicSetCallback) => {
          setTimeout(() => {
            if (newValue === 0 || Date.now() - (this.lastUpdatedBrightness[accessory.UUID] || 0) > 150) {
              this.setCharacteristic(false, accessory.context.featureId, newValue, () => {
                service?.updateCharacteristic(this.Characteristic.Brightness, Number(newValue) * 100);
                next();
              });
            } else {
              next();
            }
          }, 50);
        });
      const hasSwitchService = accessory.getService(this.Service.Switch);
      if (typeof hasSwitchService !== "undefined") {
        accessory.removeService(hasSwitchService);
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
    const feature = device.features.find((feature) =>
      ["lock", "light"].includes(feature.featureTypeCategory)
    );

    if (typeof feature === "undefined") return null;

    const uuid = this.api.hap.uuid.generate(device.id.toString());
    const type = feature.eventTypeName;
    const name = roomName + " " + device.name;

    const existingAccessory = this.accessories.find(
      (accessory) => accessory.UUID === uuid
    );

    // check the accessory was not restored from cache
    if (!existingAccessory) {
      // create a new accessory
      const accessory = new this.api.platformAccessory(name, uuid);
      accessory.context.type = type;
      accessory.context.featureId = feature.id;
      accessory.context.deviceId = device.id;

      this.log.info("Adding new accessory:", name);

      this.initServices(accessory);

      this.accessories.push(accessory);

      // register the accessory
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    } else {
      existingAccessory.context.type = type;
      existingAccessory.context.featureId = feature.id;
      existingAccessory.context.deviceId = device.id;
      this.log.info("Updating accessory:", name);
      this.api.updatePlatformAccessories([existingAccessory]);
    }

    return device.id;
  }

  discoverDevices() {
    this.withAuth().then(api => {
      api.get("/account/me").then(response => {
        const accountId = response.data.id;
        this.log.info("Found account id " + accountId);
        api.get("/account/" + accountId + "/residency").then(response => {
          if (response.data.length > 0) {
            const unit = response.data[0].unit;
            this.log.info("Found unit " + unit);
            api.get("unit/" + unit + "/rooms").then(response => {
              const rooms = response.data as Rooms;
              const deviceIds = rooms.map(room => 
                room.devices.map(this.tryAddDevice.bind(this, room.name))
              );
              this.accessories.forEach(accessory => {
                if (!deviceIds.some(ids => ids.some(id => id === accessory.context.deviceId))) {
                  this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
                }
              });
            });
          } else {
            this.log.error("Unable to find any units. Abandoning...")
          }
        });
      });
    });
  }

  withAuth() {
    return this.getToken().then(token => _axios.create({
      baseURL: IOTAS_URL,
      headers: {
        Authorization: "Bearer " + token
      }
    }))
  }

  getToken() {
    if (this.token === null) {
      return this.authenticate();
    }
    let decoded = jwt_decode(this.token) as any;
    let oneMinuteFromNow = (Date.now() + 1000 * 60) / 1000;
    if (decoded.exp < oneMinuteFromNow) {
      return this.refreshAccessToken();
    } else {
      return Promise.resolve(this.token);
    }
  }
  
  refreshAccessToken() {
  
    let body = {
      refresh: this.refreshToken,
      email: this.config.username,
    };
    return axios
      .post(`/auth/refresh`, body)
      .then((response) => {
        this.refreshToken = response.data.refresh;
        this.token = response.data.jwt as string;
        return this.token;
      })
      .catch((error) => {
        console.log("error: ");
        console.log(error);
      });
  }

  authenticate() {
    let config = {
      auth: {
        username: this.config.username,
        password: this.config.password
      },
    };
    return axios
      .post(`/auth/tokenwithrefresh`, {}, config)
      .then((response) => {
        this.refreshToken = response.data.refresh;
        this.token = response.data.jwt;
        return this.token as string;
      })
      .catch((error) => {
        console.log("error: ");
        console.log(error);
      });
  }
}