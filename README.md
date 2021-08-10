# homebridge-iotas
Based off of stevesample/homebridge-iotas-switch

## Currently supports
- Switch
- Outlet
- Light (e.g. brightness levels)
- Thermostats

# Installation
1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-iotas`
3. Update your configuration file. See the sample below.

# Configuration
Configuration sample:

 ```javascript
"platforms": [
  {
    "platform" : "homebridge-iotas",
    "name" : "Iotas",
    "username": "[My_iotas_username]",
    "password": "[My_iotas_password]",
    "unit": "[unit_name]" // optional, will default to the first one found
  }
]
```

# License
See LICENSE file
