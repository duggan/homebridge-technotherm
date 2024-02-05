import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { Technotherm } from './platform';
import { HelkiClient, Node } from './helki_client';

export class Radiator {
  private service: Service;
  private node: Node;
  private pollInterval = 10000; // Poll every 10 seconds
  private pollTimer!: NodeJS.Timeout;

  constructor(
    private readonly platform: Technotherm,
    private readonly accessory: PlatformAccessory,
    private readonly helkiClient: HelkiClient,
  ) {
    this.node = this.accessory.context.node;

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Technotherm')
      .setCharacteristic(this.platform.Characteristic.Model, 'TTKS Combination Radiator')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.product_id);

    this.service = this.accessory.getService(this.platform.Service.Thermostat) ||
      this.accessory.addService(this.platform.Service.Thermostat);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

    this.registerCharacteristics();
    this.startPolling();
  }

  registerCharacteristics() {
    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onSet(this.setTargetTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .onSet(this.setTargetHeatingCoolingState.bind(this));
  }

  async setTargetTemperature(value: CharacteristicValue) {
    try {
      const stemp = Number(value).toFixed(1);
      await this.helkiClient.setStatus(this.accessory.context.device.dev_id, this.node, {
        stemp: stemp,
        mode: 'manual',
        units: 'C',
      });
    } catch (error) {
      this.platform.log.error('Failed to set target temperature:', error);
    }
  }

  async setTargetHeatingCoolingState(value: CharacteristicValue) {
    let mode: 'manual' | 'auto' | 'off';
    if (value === this.platform.Characteristic.TargetHeatingCoolingState.HEAT) {
      mode = 'manual';
    } else if (value === this.platform.Characteristic.TargetHeatingCoolingState.AUTO) {
      mode = 'auto';
    } else {
      mode = 'off';
    }
    try {
      await this.helkiClient.setStatus(this.accessory.context.device.dev_id, this.node, { mode: mode });
    } catch (error) {
      this.platform.log.error('Failed to set target heating/cooling state:', error);
    }
  }

  startPolling() {
    this.pollTimer = setInterval(async () => {
      await this.pollAndUpdate();
    }, this.pollInterval);
  }

  async pollAndUpdate() {
    try {
      const status = await this.helkiClient.getStatus(this.accessory.context.device.dev_id, this.node);
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, parseFloat(status.mtemp));
      this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, parseFloat(status.stemp));
      const targetHeatingCoolingState = status.mode === 'auto' ? this.platform.Characteristic.TargetHeatingCoolingState.AUTO :
        status.mode === 'manual' ? this.platform.Characteristic.TargetHeatingCoolingState.HEAT :
          this.platform.Characteristic.TargetHeatingCoolingState.OFF;
      this.service.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, targetHeatingCoolingState);
      const currentHeatingCoolingState = status.active ? this.platform.Characteristic.CurrentHeatingCoolingState.HEAT :
        this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, currentHeatingCoolingState);
    } catch (error) {
      this.platform.log.error('Failed to poll device status:', error);
    }
  }

  // Call this method when the plugin is shutting down to clean up resources
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }
}
