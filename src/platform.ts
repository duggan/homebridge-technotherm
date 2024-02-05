import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { HelkiClient } from './helki_client';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { Radiator } from './radiator';

/**
 * Technotherm
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class Technotherm implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * Authenticate with the API to obtain an access token and fetch the list of devices.
   */
  async discoverDevices() {
    try {
      const helki = new HelkiClient(
        this.config.apiName,
        this.config.clientId,
        this.config.clientSecret,
        this.config.username,
        this.config.password);

      const homes = await helki.getGroupedDevices();
      for (const home of homes) {
        // Loop over the devices and register each one
        for (const device of home.devs) {
          const uuid = this.api.hap.uuid.generate(device.dev_id); // Use dev_id to generate a UUID
          const nodes = await helki.getNodes(device.dev_id);
          const node = nodes[0];

          const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

          if (existingAccessory) {
            // Accessory exists, restore from cache
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
            new Radiator(this, existingAccessory, helki);
          } else {
            // Accessory doesn't exist, add new
            const accessoryName = `${device.name} (${home.name})`
            this.log.info('Adding new accessory:', accessoryName); // Use device name for display name
            const accessory = new this.api.platformAccessory(accessoryName, uuid);
            accessory.context.device = device;
            accessory.context.node = node;
            accessory.context.home = home.name;
            new Radiator(this, accessory, helki);
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          }
        }
      }

    } catch (error: any) {
      this.log.error('Failed to discover devices:', error.message);
    }
  }

}
