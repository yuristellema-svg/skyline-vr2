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
    this.dynamics = new SandboxDynamicsSystem();
    this.atmosphere = new AtmosphereSystem(scene, sampleHeight);
    this.audio = new WindAudioSystem();
    this.routes = new RouteSystem(scene);
    this.contrails = new ContrailSystem(scene, sampleHeight);
    this.clouds = new CloudFieldSystem(scene);
    this.aiTraffic = new AiTrafficSystem(scene);
  }

  update(dt, flight, camera, phase = 'flying') {
    this.dynamics.update(dt, flight, phase);
    this.routes.update(dt, flight, camera, phase !== 'boot');
    this.aiTraffic.update(dt, flight, phase);
    this.audio.setTrafficDistance(this.aiTraffic.nearestDistance);
    this.audio.update(dt, flight, phase);
    this.atmosphere.update(dt, flight, camera);
    this.clouds.update(dt, flight, camera);
    this.contrails.update(dt, flight, phase);
  }

  dispose() {
    this.dynamics.dispose();
    this.atmosphere.dispose();
    this.audio.dispose();
    this.routes.dispose();
    this.contrails.dispose();
    this.clouds.dispose();
    this.aiTraffic.dispose();
  }
}
