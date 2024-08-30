This is by no means comprehensive, nor do I claim it is.
Many values are inferred, so they may be wrong, particularly for IDs.

## API Datas

| Method | Endpoint                                                            | Request       | Response    | Other                          |
|--------|---------------------------------------------------------------------|---------------|-------------|--------------------------------|
| POST   | `api/v1/tokenwithrefresh`                                           | Basic Auth    | jwt/refresh |                                |
| POST   | `api/v1/refreshtoken`                                               | Email + Token | jwt token   |                                |
| POST   | `api/v1/mobile_devices/register`                                    |               |             |                                |
| GET    | `api/v1/account/me`                                                 |               |             |                                |
| GET    | `api/v1/sosecure/service-available`                                 |               |             | `?&latitude=0.0&longitude=0.0` |
| GET    | `api/v1/eventtype`                                                  |               |             |                                |
| GET    | `api/v1/account/{accountId}/residency`                              |               |             |                                |
| GET    | `api/v1/certificate/mobile`                                         |               | Redacted    |                                |
| GET    | `api/v1/notification/history`                                       |               |             | `?cnt=0&unitId={unitId}`       |
| GET    | `api/v1/unit/routines/recents`                                      |               |             | `?unitId={unitId}&days=30`     |
| GET    | `api/v1/assortments`                                                |               |             |                                |
| GET    | `api/v1/unit/{unitId}`                                              |               |             |                                |
| GET    | `api/v1/unit/{unitId}/scenes`                                       |               |             |                                |
| GET    | `api/v1/building/{buildingId}`                                      |               |             |                                | 
| GET    | `api/v1/unit/{unitId}`                                              |               |             |                                |
| GET    | `api/v1/unit/{unitId}/routines`                                     |               |             |                                |
| GET    | `api/v1/amenities/resident/83885/reservation`                       |               |             |                                |
| GET    | `api/v1/unit/{unitId}/guests`                                       |               |             |                                |
| GET    | `api/v1/unit/{unitId}/rooms`                                        |               |             |                                |
| GET    | `api/v1/unit/{unitId}/access_options`                               |               |             |                                |
| GET    | `api/v1/building/{buildingId}/configuration`                        |               |             |                                | 
| POST   | `api/v1/scene`                                                      |               |             | New Scene?                     |
| POST   | `api/v1/feature_action`                                             |               |             | New Scene?                     | 
| POST   | `api/v1/scene/{sceneId}/set`                                        |               |             |                                | 
| GET    | `api/v1/access_management/door_codes/device/{deviceId}/details`     |               |             |                                ||
| GET    | `api/v1/access_management/door_codes/resident/{residentId}/details` |               |             |                                ||
| PUT    | `api/v1/feature/{featureId}/value`                                  |               |             |                                |

Assets
`https://iotas-resident-app-assets.s3-us-west-2.amazonaws.com`

#### SCENE Request

```json
{
  "backgroundPhoto": "scene_photo_01",
  "name": "Scene Name",
  "unit": "{unitId: Int}"
}
```

#### SCENE Responses

```json
{
  "id": "{SceneId: Int}",
  "unit": "{unitId: Int}",
  "name": "Scene Name",
  "backgroundPhoto": "scene_photo_01",
  "featureActions": [],
  "featureTypeActions": [],
  "unitRoutines": []
}
```

#### FEATURE ACTION Request

```json
{
  "feature": "{featureId: Int}",
  "scene": "{sceneId: Int}",
  "value": "{value: Float}"
}
```

#### FEATURE ACTION Response

```json
{
  "id": "{featureActionId: Int}",
  "scene": "{sceneId: Int}",
  "feature": "{featureId: Int}",
  "featureTypeCategory": "{Category: String}",
  "value": "{value: Float}",
  "device": "{deviceId: Int}",
  "room": "{roomId: Int}"
}
```

#### SCENES Request

```json
[
  {
    "id": "{SceneId: Int}",
    "unit": "{unitId: Int}",
    "name": "Scene Name",
    "backgroundPhoto": "scene_photo_01",
    "featureActions": [
      {
        "id": "{featureActionId: Int}",
        "scene": "{sceneId: Int}",
        "feature": "{featureId: Int}",
        "featureTypeCategory": "{Category: String}",
        "value": "{value: Float}",
        "device": "{deviceId: Int}",
        "room": "{roomId: Int}"
      }
    ],
    "featureTypeActions": [],
    "unitRoutines": []
  },
  {},
  {},
  {}
]
```

#### FEATURE VALUE request

```json
{
  "value": "{value: Float}"
}
```

See [EVENT TYPE](EVENTTYPE%20Response)

#### RESIDENT DOOR CODE RESPONSE

```json
[
  {
    "isOnline": "{boolean: Boolean}",
    "deviceId": "{deviceId: Int}",
    "deviceName": "Lock",
    "roomName": "{roomName: String}",
    "hardware": "{hardwareName: String}",
    "isCodeSet": "{boolean: Boolean}",
    "batteryLevel": "{batteryLevel: Float}",
    "type": "RESIDENT",
    "residentId": "{residentId: Int}",
    "firstName": "{firstName: String}",
    "lastName": "{lastName: String}"
  }
]
```

#### FEATURE DOOR CODE RESPONSE

```json
[
  {
    "id": "{someId: Int}",
    "deviceId": "{deviceId: Int}",
    "unitId": "{unitId: Int}",
    "roomName": "{roomName: String}",
    "pinCode": "{pinCode: Int}",
    "isCodeSet": "{boolean: Boolean}",
    "type": "UNIT"
  }
]
```

#### RESIDENCY Response

```json
[
  {
    "id": "{someId: Int}",
    "accountId": "{accountId: Int}",
    "unitId": "{unitId: Int}",
    "buildingId": "{buildingId: Int}",
    "unitName": "{unitCode: String}",
    "dateFrom": "{date:String:YYYY-MM-DDTHH:MM:SS}",
    "tenant": "{boolean: Boolean}",
    "unitAdmin": "{boolean: Boolean}",
    "email": "{email:String}",
    "firstName": "{firstName: String}",
    "lastName": "{lastName: String}",
    "dateFrom": "{date:String:YYYY-MM-DDTHH:MM:SS}",
    "suspended": "{boolean: Boolean}",
    "account": {
      "id": "{accoundId: Int}",
      "email": "{email:String}",
      "firstName": "{firstName: String}",
      "lastName": "{lastName: String}",
      "hasPassword": "{boolean: Boolean}"
    }
  }
]
```

#### ACCOUNT ME Response

```json
{
  "id": "{accoundId: Int}",
  "email": "{email:String}",
  "hasPassword": "{boolean: Boolean}",
  "passwordSetAt": "{date:String:YYYY-MM-DDTHH:MM:SS}",
  "passwordFirstSetAt": "{date:String:YYYY-MM-DDTHH:MM:SS}",
  "firstName": "{firstName: String}",
  "lastName": "{lastName: String}",
  "createdAt": "{date:String:YYYY-MM-DDTHH:MM:SS}",
  "keepConnected": "{boolean: Boolean}",
  "shareData": "{boolean: Boolean}",
  "accessibilityColor": "{boolean: Boolean}",
  "onboardingComplete": "{boolean: Boolean}",
  "soSecureRegistered": "{boolean: Boolean}",
  "phoneNumberVerified": "{boolean: Boolean}",
  "isAdmin": "{boolean: Boolean}",
  "isSuperAdmin": "{boolean: Boolean}",
  "mfaEnabled": "{boolean: Boolean}",
  "mfaPopup": "{boolean: Boolean}"
}
```

#### EVENTTYPE Response

```json
[
  {
    "id": 1,
    "name": "OnOff",
    "units": "Binary",
    "minValue": 0.0,
    "maxValue": 1.0
  },
  {
    "id": 2,
    "name": "Power",
    "units": "Amps",
    "minValue": 0.0,
    "maxValue": 100.0
  },
  {
    "id": 3,
    "name": "Level",
    "units": "Proportion",
    "minValue": 0.0,
    "maxValue": 1.0
  },
  {
    "id": 4,
    "name": "ThermostatMode",
    "units": "Enumeration",
    "minValue": 0.0,
    "maxValue": 5.0
  },
  {
    "id": 5,
    "name": "FanMode",
    "units": "Enumeration",
    "minValue": 0.0,
    "maxValue": 4.0
  },
  {
    "id": 6,
    "name": "Temperature",
    "units": "DegreesFahrenheit",
    "minValue": -20.0,
    "maxValue": 120.0
  },
  {
    "id": 7,
    "name": "List",
    "units": "Enumeration",
    "minValue": 0.0,
    "maxValue": 25.0
  },
  {
    "id": 11,
    "name": "Time",
    "units": "Enumeration",
    "minValue": 0.0,
    "maxValue": 86400.0
  },
  {
    "id": 12,
    "name": "PinCode",
    "units": "PinCode",
    "minValue": 0.0,
    "maxValue": 999999.0
  }
]
```

#### MOBILE DEVICE REGISTER

```json
{
  "flavor": "IOTAS",
  "mobileDeviceId": "{someHash: String}",
  "platform": "{platform: String}"
}
```

#### ASSORTMENTS RESPONSE

```json
[
  {
    "id": "{someId: Int}",
    "accountId": "{accountId: Int}",
    "entityType": "favorite_device",
    "parentId": "{someId: Int}",
    "parentType": "unit",
    "sortedIds": [
      "{someId: Int}",
      {},
      {},
      {}
    ],
    "children": null
  }
]
```

#### UNIT Response

```json
{
  "id": "{unitId: Int}",
  "building": "{buildingId: Int}",
  "unitTemplate": {
    "id": "{someId: Int}",
    "facilityDescription": "{someValue: Int}",
    "buildingId": "{buildingId: Int}",
    "name": "{someName: String}",
    "roomCount": "{roomCount: Int}",
    "deviceCount": "{deviceCount: Int}",
    "unitCount": "{unitCount: Int}"
  },
  "name": "{unitName: String}",
  "model": "{boolean: Boolean}",
  "common": "{boolean: Boolean}",
  "flipped": "{boolean: Boolean}",
  "hubs": [
    {
      "id": "{hubId: Int}",
      "serialNumber": "{serial: String}",
      "hardware": "{hardwareString: String}",
      "group": "connect2-prod",
      "ipAddress": "null",
      "monitorEnergy": "{boolean: Boolean}",
      "lastAlive": "{date:String:YYYY-MM-DDTHH:MM:SS}",
      "otaVersion": "{version:Int.Int.Int}",
      "iotasEngineVersion": "{version:Int.Int.Int-Int}",
      "activeConnection": "eth",
      "connectionType": "Ethernet",
      "uptime": "{uptime: Int}",
      "diskUsage": "{diskUsage: Float}",
      "unit": "{unitId: Int}",
      "lastSeen": "{timestamp: Int}",
      "mappedCount": "{someValue: Int}",
      "unmappedCount": "{someValue: Int}",
      "pairedCount": "{someValue: Int}",
      "paired": "{boolean: Boolean}",
      "online": "{boolean: Boolean}",
      "certExpirationDate": "{someValue: Int}",
      "macAddress": "{macAddress: String}",
      "deviceName": "{deviceName: String}"
    }
  ],
  "provisionedStatus": "Provisioned",
  "tenantCount": "{tenantCount: Int}",
  "nonTenantCount": "{nonTenantCount: Int}",
  "editedRoutines": "{boolean: Boolean}",
  "deviceCount": "{deviceCount: Int}",
  "provisionedAt": "{date:String:YYYY-MM-DDTHH:MM:SS}",
  "lockType": "lock",
  "rooms": [
    "See Rooms..."
  ]
}
```

#### ROOMS Response

```json
[
  {
    "id": "{roomId: Int}",
    "unit": "{unitId: Int}",
    "roomTemplate": {
      "id": "{roomTemplateId: Int}",
      "unitTemplateId": "{tempateId: Int}",
      "name": "{roomName: String}",
      "isPrivate": "{boolean: Boolean}"
    },
    "name": "{roomName: String}",
    "devices": [
      "See Device"
    ]
  },
  {},
  {},
  {}
]
```

#### BUILDING Response

```json
{
  "id": "buildingId: Int",
  "facilityDescription": "{someId: Int}",
  "managerFirstName": "{firstName: String}",
  "managerLastName": "{lastName: String}",
  "phone": "{telephone: String: XXX-XXX-XXXX}",
  "email": "{email: String}",
  "address": "{address: String}",
  "city": "{city: String}",
  "state": "{state: String: 2Letter}",
  "country": "{country: String: 2Letter}",
  "zipCode": "{zipCode: String}",
  "timezoneName": "{timezone: String: LOC\\LOC\\LOC}",
  "facilityName": "{facilityName: String}",
  "name": "{name: String}",
  "unitCount": "{unitCount: Int}",
  "salesForceId": "{salesForceId: Int}",
  "status": "LIVE",
  "temperatureUnits": "{unit: String: F/C}",
  "appContextId": 1,
  "platformId": 1,
  "vacantConnectivity": "PROPERTY_ETHERNET",
  "occupiedConnectivity": "PROPERTY_ETHERNET",
  "commonAreaConnectivity": "UNKNOWN",
  "reportUrl": "{reportUrl: String}"
}
```

#### CONFIGURATION Response

```json
{
  "id": "{someId: Int}",
  "buildingId": "{buildingId: Int}",
  "packageManagement": "{boolean: Boolean}",
  "dataInsights": "{boolean: Boolean}",
  "maintenanceTickets": "{boolean: Boolean}",
  "prospectTour": "{boolean: Boolean}",
  "guestAccess": "{boolean: Boolean}",
  "alexaForResidential": "{boolean: Boolean}",
  "butterflyMxVisitorCalling": "{boolean: Boolean}",
  "soSecure": "{boolean: Boolean}",
  "reservations": "{boolean: Boolean}",
  "mfAuth": "{boolean: Boolean}",
  "occupiedDeviceControl": "{boolean: Boolean}",
  "suites": "{boolean: Boolean}"
}
```

