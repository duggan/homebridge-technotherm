import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { Technotherm } from './platform';
import { HelkiClient, Node, Status } from './helki_client';

export class Radiator {
  private service: Service;
  private node: Node;

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

    this.helkiClient.subscribeToDeviceUpdates(this.accessory.context.device.dev_id, this.onDeviceUpdate.bind(this));
  }

  onDeviceUpdate(status: Status): void {
    const currentTemperature = status.mtemp ? parseFloat(status.mtemp) : 0;
    const targetTemperature = status.stemp ? parseFloat(status.stemp) : 0;

    this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, currentTemperature);
    this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, targetTemperature);

    switch (status.mode) {
      case 'auto':
      case 'modified_auto':
        this.service.updateCharacteristic(
          this.platform.Characteristic.TargetHeatingCoolingState,
          this.platform.Characteristic.TargetHeatingCoolingState.AUTO,
        );
        break;
      case 'manual':
        this.service.updateCharacteristic(
          this.platform.Characteristic.TargetHeatingCoolingState,
          this.platform.Characteristic.TargetHeatingCoolingState.HEAT,
        );
        break;
      case 'off':
        this.service.updateCharacteristic(
          this.platform.Characteristic.TargetHeatingCoolingState,
          this.platform.Characteristic.TargetHeatingCoolingState.OFF,
        );
        break;
    }

    const currentHeatingCoolingState = status.active ? this.platform.Characteristic.CurrentHeatingCoolingState.HEAT :
      this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, currentHeatingCoolingState);
  }

  registerCharacteristics() {
    // Set the properties of TargetTemperature characteristic to allow temperatures down to 1°C
    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .setProps({
        minValue: 1,
        maxValue: 40,
        minStep: 0.5,
      })
      .onSet(this.setTargetTemperature.bind(this));


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
}
