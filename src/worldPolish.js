import { AtmosphereSystem } from './atmosphere.js';
import { WindAudioSystem } from './windAudio.js';
import { RouteSystem } from './routeSystem.js';
import { ContrailSystem } from './contrails.js';
import { SandboxDynamicsSystem } from './sandboxDynamics.js';
import { AiTrafficSystem } from './aiTraffic.js';
import { CloudFieldSystem } from './cloudField.js';

export class WorldPolishSystem {
  constructor(scene, options = {}) {
    const sampleHeight = options.sampleHeight || null;

    this.disabled = new Set();
    this.reported = new Set();

    this.dynamics = this._create(
      'flight dynamics',
      () => new SandboxDynamicsSystem(),
    );

    this.atmosphere = this._create(
      'atmosphere',
      () => new AtmosphereSystem(scene, sampleHeight),
    );

    this.audio = this._create(
      'audio',
      () => new WindAudioSystem(),
    );

    this.routes = this._create(
      'boost gates',
      () => new RouteSystem(scene),
    );

    this.contrails = this._create(
      'contrails',
      () => new ContrailSystem(scene, sampleHeight),
    );

    this.clouds = this._create(
      'clouds',
      () => new CloudFieldSystem(scene),
    );

    this.aiTraffic = this._create(
      'AI aircraft',
      () => new AiTrafficSystem(scene),
    );
  }

  _fail(name, error) {
    this.disabled.add(name);

    if (!this.reported.has(name)) {
      this.reported.add(name);
      console.error(
        `[Skyline] Disabled optional system: ${name}`,
        error,
      );
    }
  }

  _create(name, factory) {
    try {
      return factory();
    } catch (error) {
      this._fail(name, error);
      return null;
    }
  }

  _run(name, callback) {
    if (this.disabled.has(name)) return;

    try {
      callback();
    } catch (error) {
      this._fail(name, error);
    }
  }

  update(dt, flight, camera, phase = 'flying') {
    this._run(
      'flight dynamics',
      () => this.dynamics?.update(dt, flight, phase),
    );

    this._run(
      'boost gates',
      () => this.routes?.update(
        dt,
        flight,
        camera,
        phase !== 'boot',
      ),
    );

    this._run(
      'AI aircraft',
      () => this.aiTraffic?.update(dt, flight, phase),
    );

    this._run(
      'audio',
      () => {
        this.audio?.setTrafficDistance?.(
          this.aiTraffic?.nearestDistance ?? Infinity,
        );

        this.audio?.update(dt, flight, phase);
      },
    );

    this._run(
      'atmosphere',
      () => this.atmosphere?.update(dt, flight, camera),
    );

    this._run(
      'clouds',
      () => this.clouds?.update(dt, flight, camera),
    );

    this._run(
      'contrails',
      () => this.contrails?.update(dt, flight, phase),
    );
  }

  dispose() {
    for (const system of [
      this.dynamics,
      this.atmosphere,
      this.audio,
      this.routes,
      this.contrails,
      this.clouds,
      this.aiTraffic,
    ]) {
      try {
        system?.dispose?.();
      } catch {
        // Optional visual/audio cleanup must never break the game.
      }
    }
  }
}
