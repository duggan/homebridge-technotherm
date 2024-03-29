# Homebridge Technotherm

![Node v18.x](https://github.com/duggan/homebridge-technotherm/actions/workflows/build_node18.yml/badge.svg)
![Node v20.x](https://github.com/duggan/homebridge-technotherm/actions/workflows/build_node20.yml/badge.svg)

Technotherm / Lucht LHZ radiators in Apple Home via Homebridge.

**Status:** Experimental 🧪

Potentially can be modified to support a variety of other radiators (e.g. Haverland) that use the same cloud service for configuration (api.helki.com).

## Audience: developers

Works for me, might work for you! You'll need to be comfortable digging into Homebridge code if you want to tinker/add functionality or figure out why something doesn't work, but there's nothing esoteric in there, just wiring up APIs.

## Requirements


* **Username**: username registered with Lucht LHZ app
* **Password**: password registered with the Lucht LHZ app

## Credits

This would have been a lot more difficult without Graham Bennett's [smartbox](https://github.com/graham33/smartbox) project, and
the various contributors in the [Home Assistant forum discussion around it](https://community.home-assistant.io/t/haverland-radiators-smart-box-integration/133596). Thanks to everyone there!
