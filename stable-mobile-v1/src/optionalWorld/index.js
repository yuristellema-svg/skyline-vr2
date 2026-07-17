import { AtmosphereSystem } from '../atmosphere.js';
import { ContrailSystem } from '../contrails.js';
import { SandboxDynamicsSystem } from '../sandboxDynamics.js';
import { SafeSystemRegistry } from './safeSystem.js';
import { BoostHoopSystem } from './boostHoops.js';
import { WorldSpaceCloudSystem } from './cloudField.js';
import { DistantCityVisibilitySystem } from './distantCity.js';
import { AiAircraftSystem } from './aiAircraft.js';
import { OptionalWorldAudioSystem } from './audio.js';

function enabled(options, name, fallback = true) {
  return options[name] === undefined ? fallback : options[name] !== false;
}

export class OptionalWorldSystem {
  constructor(scene, options = {}) {
    this.registry = new SafeSystemRegistry({
      logger: options.logger ?? console,
    });

    const sampleHeight = options.sampleHeight || null;

    this.registry.register(
      'sandbox dynamics',
      () => new SandboxDynamicsSystem(),
      enabled(options, 'dynamics'),
    );
    this.registry.register(
      'atmosphere',
      () => new AtmosphereSystem(scene, sampleHeight),
      enabled(options, 'atmosphere'),
    );
    this.registry.register(
      'boost hoops',
      () => new BoostHoopSystem(scene, options.boostOptions),
      enabled(options, 'routes'),
    );
    this.registry.register(
      'clouds',
      () => new WorldSpaceCloudSystem(scene, options.cloudOptions),
      enabled(options, 'clouds'),
    );
    this.registry.register(
      'distant city visibility',
      () => new DistantCityVisibilitySystem(scene, options.cityOptions),
      enabled(options, 'city'),
    );
    this.registry.register(
      'AI aircraft',
      () => new AiAircraftSystem(scene, options.aiOptions),
      enabled(options, 'aiTraffic'),
    );
    this.registry.register(
      'audio',
      () => new OptionalWorldAudioSystem(options.audioOptions),
      enabled(options, 'audio'),
    );
    this.registry.register(
      'contrails',
      () => new ContrailSystem(scene, sampleHeight),
      enabled(options, 'contrails'),
    );
  }

  fixedStepUpdate(
    dt,
    flight,
    phase = 'flying',
  ) {
    this.registry.invoke(
      'sandbox dynamics',
      'update',
      dt,
      flight,
      phase,
    );
  }

  update(
    dt,
    flight,
    camera,
    phase = 'flying',
  ) {
    this.registry.invoke('boost hoops', 'update', dt, flight, camera, phase);
    this.registry.invoke('AI aircraft', 'update', dt, flight, phase);

    const trafficSources =
      this.registry.get('AI aircraft')?.getAudioSources?.() ?? [];

    this.registry.invoke(
      'audio',
      'update',
      dt,
      flight,
      camera,
      phase,
      trafficSources,
    );
    this.registry.invoke('atmosphere', 'update', dt, flight, camera);
    this.registry.invoke('clouds', 'update', dt);
    this.registry.invoke('distant city visibility', 'update', dt);
    this.registry.invoke('contrails', 'update', dt, flight, phase);
  }

  getStatus() {
    return this.registry.status();
  }

  dispose() {
    this.registry.dispose();
  }
}
