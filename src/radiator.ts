import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { Technotherm } from './platform';
import { HelkiClient, Node } from './helki_client';

export class Radiator {
  private service: Service;
  private node: Node; // Added to store the node information

  constructor(
    private readonly platform: Technotherm,
    private readonly accessory: PlatformAccessory,
    private readonly helkiClient: HelkiClient,
  ) {
    // Initialize node from accessory context
    this.node = this.accessory.context.node;

    // Set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Technotherm')
      .setCharacteristic(this.platform.Characteristic.Model, 'TTKS Combination Radiator')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.product_id);

    // Create a new Thermostat service
    this.service = this.accessory.getService(this.platform.Service.Thermostat) ||
      this.accessory.addService(this.platform.Service.Thermostat);

    // Set the service name
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

    // Register handlers for characteristics
    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onSet(this.setTargetTemperature.bind(this))
      .onGet(this.getTargetTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .onSet(this.setTargetHeatingCoolingState.bind(this))
      .onGet(this.getTargetHeatingCoolingState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));
  }

  async setTargetTemperature(value: CharacteristicValue) {
    // Simplify by directly using the node and helkiClient
    try {
      await this.helkiClient.setStatus(this.accessory.context.device.dev_id, this.node,
        {
          stemp: value.toString(),
          mode: 'manual',
          units: 'C',
        });
    } catch (error) {
      this.platform.log.error('Failed to set target temperature:', error);
    }
  }

  async getTargetTemperature(): Promise<CharacteristicValue> {
    try {
      const status = await this.helkiClient.getStatus(this.accessory.context.device.dev_id, this.node);
      return parseFloat(status.stemp);
    } catch (error) {
      this.platform.log.error('Failed to get target temperature:', error);
      return 0; // Return a sensible default in case of error
    }
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    try {
      const status = await this.helkiClient.getStatus(this.accessory.context.device.dev_id, this.node);
      return parseFloat(status.mtemp);
    } catch (error) {
      this.platform.log.error('Failed to get current temperature:', error);
      return 0; // Return a sensible default in case of error
    }
  }

  async setTargetHeatingCoolingState(value: CharacteristicValue) {
    let mode: 'manual' | 'auto' | 'off';
    if (value === this.platform.Characteristic.TargetHeatingCoolingState.HEAT) {
      mode = 'manual'; // Assuming manual control for heating
    } else if (value === this.platform.Characteristic.TargetHeatingCoolingState.AUTO) {
      mode = 'auto'; // Assuming auto control
    } else {
      mode = 'off';
    }
    // Set the mode accordingly
    try {
      await this.helkiClient.setStatus(this.accessory.context.device.dev_id, this.node, { mode: mode });
    } catch (error) {
      this.platform.log.error('Failed to set target heating/cooling state:', error);
    }
  }

  async getTargetHeatingCoolingState(): Promise<CharacteristicValue> {
    try {
      const status = await this.helkiClient.getStatus(this.accessory.context.device.dev_id, this.node);
      switch (status.mode) {
        case 'auto':
          return this.platform.Characteristic.TargetHeatingCoolingState.AUTO;
        case 'manual':
          return this.platform.Characteristic.TargetHeatingCoolingState.HEAT; // Assuming manual mode is for heating
        default:
          return this.platform.Characteristic.TargetHeatingCoolingState.OFF;
      }
    } catch (error) {
      this.platform.log.error('Failed to get target heating/cooling state:', error);
      return this.platform.Characteristic.TargetHeatingCoolingState.OFF;
    }
  }

  async getCurrentHeatingCoolingState(): Promise<CharacteristicValue> {
    try {
      const status = await this.helkiClient.getStatus(this.accessory.context.device.dev_id, this.node);
      // Determine the current heating/cooling state based on active heating/cooling status
      if (status.active) {
        return this.platform.Characteristic.CurrentHeatingCoolingState.HEAT; // Assuming active means heating
      }
      return this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
    } catch (error) {
      this.platform.log.error('Failed to get current heating/cooling state:', error);
      return this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
    }
  }
}
