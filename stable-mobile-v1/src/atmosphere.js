import * as THREE from '../vendor/three.module.min.js';

const SKY_VERTEX = `
  varying vec3 vDirection;

  void main() {
    vDirection = normalize(position);
    gl_Position =
      projectionMatrix *
      modelViewMatrix *
      vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = `
  uniform vec3 zenithColor;
  uniform vec3 upperColor;
  uniform vec3 horizonColor;
  uniform vec3 groundHazeColor;
  uniform vec3 sunColor;
  uniform float sunWarmth;

  varying vec3 vDirection;

  void main() {
    float y =
      clamp(vDirection.y, -1.0, 1.0);

    float skyBlend =
      smoothstep(-0.05, 0.72, y);

    float upperBlend =
      smoothstep(0.18, 0.92, y);

    float horizonBand =
      1.0 -
      smoothstep(
        0.0,
        0.34,
        abs(y)
      );

    vec3 sky =
      mix(
        horizonColor,
        upperColor,
        skyBlend
      );

    sky =
      mix(
        sky,
        zenithColor,
        upperBlend
      );

    sky =
      mix(
        sky,
        groundHazeColor,
        smoothstep(
          -0.08,
          -0.55,
          y
        )
      );

    sky +=
      sunColor *
      horizonBand *
      sunWarmth *
      0.18;

    gl_FragColor =
      vec4(sky, 1.0);
  }
`;

function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value),
  );
}

function smoothstep(
  min,
  max,
  value,
) {
  if (max === min) {
    return value >= max ? 1 : 0;
  }

  const t =
    clamp(
      (value - min) /
        (max - min),
      0,
      1,
    );

  return t * t * (3 - 2 * t);
}

function damp(
  current,
  target,
  response,
  dt,
) {
  return (
    target +
    (
      current -
      target
    ) *
    Math.exp(
      -response * dt
    )
  );
}

function safeHeight(
  sampleHeight,
  x,
  z,
) {
  if (
    typeof sampleHeight !==
    'function'
  ) {
    return 0;
  }

  try {
    const value =
      sampleHeight(x, z);

    return Number.isFinite(value)
      ? value
      : 0;
  } catch {
    return 0;
  }
}

function getSpeed(flight) {
  if (
    Number.isFinite(
      flight?.speed,
    )
  ) {
    return Math.max(
      0,
      flight.speed,
    );
  }

  return (
    flight?.velocity
      ?.length?.() ??
    0
  );
}

function phaseName(
  time,
  sunHeight,
) {
  if (sunHeight < -0.14) {
    return 'NIGHT';
  }

  if (time < 0.36) {
    return 'SUNRISE';
  }

  if (time < 0.69) {
    return 'DAY';
  }

  if (time < 0.82) {
    return 'SUNSET';
  }

  return 'NIGHT';
}

function createStars() {
  const count = 260;
  const positions =
    new Float32Array(
      count * 3,
    );

  let seed = 9417;

  const random = () => {
    seed =
      (
        Math.imul(
          seed,
          1664525,
        ) +
        1013904223
      ) >>> 0;

    return seed /
      4294967296;
  };

  for (
    let index = 0;
    index < count;
    index += 1
  ) {
    const azimuth =
      random() *
      Math.PI *
      2;

    const elevation =
      0.12 +
      random() *
      1.25;

    const radius =
      4800 +
      random() *
      400;

    const horizontal =
      Math.cos(elevation) *
      radius;

    const offset =
      index * 3;

    positions[offset] =
      Math.cos(azimuth) *
      horizontal;

    positions[offset + 1] =
      Math.sin(elevation) *
      radius;

    positions[offset + 2] =
      Math.sin(azimuth) *
      horizontal;
  }

  const geometry =
    new THREE.BufferGeometry();

  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      positions,
      3,
    ),
  );

  const material =
    new THREE.PointsMaterial({
      color: 0xe8efff,
      size: 9,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });

  const stars =
    new THREE.Points(
      geometry,
      material,
    );

  stars.name =
    'bundle-b-night-stars';

  stars.frustumCulled = false;

  return stars;
}

// SKYLINE_BUNDLE_B_ENVIRONMENT
export class AtmosphereSystem {
  constructor(
    scene,
    sampleHeight = null,
  ) {
    this.scene = scene;
    this.sampleHeight =
      sampleHeight;

    this.elapsed = 0;
    this.dayDuration = 480;
    this.timeOfDay = 0.235;
    this.timePaused = false;
    this.lastEventSecond = -1;

    this.fogNear = 720;
    this.fogFar = 2200;

    this.fogColor =
      new THREE.Color(
        0x9ab5bd,
      );

    this.targetFogColor =
      this.fogColor.clone();

    this.skyRoot =
      new THREE.Group();

    this.skyRoot.name =
      'bundle-b-sky-root';

    this.skyMaterial =
      new THREE.ShaderMaterial({
        uniforms: {
          zenithColor: {
            value:
              new THREE.Color(
                0x3e6d86,
              ),
          },

          upperColor: {
            value:
              new THREE.Color(
                0x6f9eb1,
              ),
          },

          horizonColor: {
            value:
              new THREE.Color(
                0xc1c8bd,
              ),
          },

          groundHazeColor: {
            value:
              new THREE.Color(
                0x8e9b89,
              ),
          },

          sunColor: {
            value:
              new THREE.Color(
                0xffa46d,
              ),
          },

          sunWarmth: {
            value: 0.45,
          },
        },

        vertexShader:
          SKY_VERTEX,

        fragmentShader:
          SKY_FRAGMENT,

        side:
          THREE.BackSide,

        depthWrite: false,
        depthTest: false,
        fog: false,
      });

    this.sky =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          5600,
          36,
          22,
        ),

        this.skyMaterial,
      );

    this.sky.name =
      'bundle-b-dynamic-sky';

    this.sky.frustumCulled =
      false;

    this.sky.renderOrder =
      -1000;

    this.skyRoot.add(
      this.sky,
    );

    this.stars =
      createStars();

    this.skyRoot.add(
      this.stars,
    );

    this.hazeMaterial =
      new THREE.MeshBasicMaterial({
        color: 0xc4c6b7,
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
        depthTest: false,
        side:
          THREE.DoubleSide,
        fog: false,
      });

    this.hazeRing =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          5000,
          5000,
          420,
          64,
          1,
          true,
        ),

        this.hazeMaterial,
      );

    this.hazeRing.name =
      'bundle-b-horizon-haze';

    this.hazeRing.frustumCulled =
      false;

    this.hazeRing.renderOrder =
      -900;

    this.hazeRing.position.y =
      -80;

    this.skyRoot.add(
      this.hazeRing,
    );

    this.sunMaterial =
      new THREE.MeshBasicMaterial({
        color: 0xffd09a,
        fog: false,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });

    this.sun =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          52,
          20,
          12,
        ),

        this.sunMaterial,
      );

    this.sun.renderOrder =
      -850;

    this.sun.frustumCulled =
      false;

    this.skyRoot.add(
      this.sun,
    );

    this.moonMaterial =
      new THREE.MeshBasicMaterial({
        color: 0xd8e4ff,
        fog: false,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0,
        toneMapped: false,
      });

    this.moon =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          34,
          18,
          12,
        ),

        this.moonMaterial,
      );

    this.moon.renderOrder =
      -851;

    this.moon.frustumCulled =
      false;

    this.skyRoot.add(
      this.moon,
    );

    this.scene.add(
      this.skyRoot,
    );

    this.oceanMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x315f78,
        roughness: 0.48,
        metalness: 0.04,
        transparent: true,
        opacity: 0.94,
        depthWrite: true,
        fog: true,
      });

    this.ocean =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          24000,
          24000,
          1,
          1,
        ),

        this.oceanMaterial,
      );

    this.ocean.name =
      'bundle-b-ocean';

    this.ocean.rotation.x =
      -Math.PI / 2;

    this.ocean.position.y =
      -12;

    this.ocean.receiveShadow =
      false;

    this.scene.add(
      this.ocean,
    );

    this.hemisphere =
      new THREE.HemisphereLight(
        0xaad7ff,
        0x455044,
        1.15,
      );

    this.hemisphere.name =
      'bundle-b-hemisphere-light';

    this.scene.add(
      this.hemisphere,
    );

    this.sunLight =
      new THREE.DirectionalLight(
        0xfff0d3,
        1.35,
      );

    this.sunLight.name =
      'bundle-b-sun-light';

    this.sunLight.castShadow =
      false;

    this.sunTarget =
      new THREE.Object3D();

    this.scene.add(
      this.sunTarget,
    );

    this.sunLight.target =
      this.sunTarget;

    this.scene.add(
      this.sunLight,
    );

    this.moonLight =
      new THREE.DirectionalLight(
        0x8098cc,
        0,
      );

    this.moonLight.name =
      'bundle-b-moon-light';

    this.moonLight.castShadow =
      false;

    this.moonLight.target =
      this.sunTarget;

    this.scene.add(
      this.moonLight,
    );

    this._onKeyDown =
      event => {
        if (
          event.repeat ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        ) {
          return;
        }

        if (
          event.code ===
          'KeyN'
        ) {
          this.timeOfDay =
            (
              this.timeOfDay +
              0.125
            ) % 1;
        }

        if (
          event.code ===
          'KeyP'
        ) {
          this.timePaused =
            !this.timePaused;
        }
      };

    globalThis.window
      ?.addEventListener?.(
        'keydown',
        this._onKeyDown,
      );

    this._ensureFog();
  }

  _ensureFog() {
    if (
      !this.scene.fog ||
      !this.scene.fog.isFog
    ) {
      this.scene.fog =
        new THREE.Fog(
          this.fogColor.clone(),
          this.fogNear,
          this.fogFar,
        );
    }
  }

  _emitState(
    daylight,
    twilight,
    sunHeight,
  ) {
    const second =
      Math.floor(
        this.elapsed,
      );

    if (
      second ===
      this.lastEventSecond
    ) {
      return;
    }

    this.lastEventSecond =
      second;

    const EventType =
      globalThis.CustomEvent;

    if (
      typeof EventType !==
        'function' ||
      !globalThis.window
        ?.dispatchEvent
    ) {
      return;
    }

    globalThis.window
      .dispatchEvent(
        new EventType(
          'skyline:time-of-day',
          {
            detail: {
              time:
                this.timeOfDay,

              daylight,
              twilight,
              sunHeight,

              phase:
                phaseName(
                  this.timeOfDay,
                  sunHeight,
                ),
            },
          },
        ),
      );
  }

  update(
    dt,
    flight,
    camera,
  ) {
    if (!camera) {
      return;
    }

    const safeDt =
      clamp(
        Number(dt) || 0,
        0,
        0.1,
      );

    this.elapsed +=
      safeDt;

    if (
      !this.timePaused
    ) {
      this.timeOfDay =
        (
          this.timeOfDay +
          safeDt /
            this.dayDuration
        ) % 1;
    }

    this._ensureFog();

    this.skyRoot.position
      .copy(
        camera.position,
      );

    this.ocean.position.x =
      camera.position.x;

    this.ocean.position.z =
      camera.position.z;

    const solarAngle =
      this.timeOfDay *
        Math.PI *
        2 -
      Math.PI;

    const sunHeight =
      Math.sin(
        solarAngle,
      );

    const sunHorizontal =
      Math.cos(
        solarAngle,
      );

    const daylight =
      smoothstep(
        -0.16,
        0.20,
        sunHeight,
      );

    const night =
      1 - daylight;

    const twilight =
      clamp(
        1 -
          Math.abs(
            sunHeight,
          ) /
            0.34,
        0,
        1,
      ) *
      smoothstep(
        -0.22,
        0.16,
        sunHeight,
      );

    const skyRadius =
      4700;

    this.sun.position.set(
      -sunHorizontal *
        skyRadius *
        0.72,

      sunHeight *
        skyRadius *
        0.78,

      -skyRadius *
        0.55,
    );

    this.moon.position
      .copy(
        this.sun.position,
      )
      .multiplyScalar(-1);

    this.sun.visible =
      sunHeight > -0.20;

    this.moon.visible =
      sunHeight < 0.26;

    this.sunMaterial.opacity =
      daylight;

    this.moonMaterial.opacity =
      night * 0.88;

    this.stars.material.opacity =
      smoothstep(
        0.22,
        0.88,
        night,
      ) *
      0.88;

    const nightZenith =
      new THREE.Color(
        0x071124,
      );

    const dayZenith =
      new THREE.Color(
        0x326f9f,
      );

    const nightUpper =
      new THREE.Color(
        0x142443,
      );

    const dayUpper =
      new THREE.Color(
        0x6da9ca,
      );

    const nightHorizon =
      new THREE.Color(
        0x25334a,
      );

    const dayHorizon =
      new THREE.Color(
        0xc2d1d4,
      );

    const sunsetHorizon =
      new THREE.Color(
        0xf19a6b,
      );

    const nightGround =
      new THREE.Color(
        0x111927,
      );

    const dayGround =
      new THREE.Color(
        0x82938c,
      );

    const zenith =
      nightZenith
        .clone()
        .lerp(
          dayZenith,
          daylight,
        );

    const upper =
      nightUpper
        .clone()
        .lerp(
          dayUpper,
          daylight,
        );

    const horizon =
      nightHorizon
        .clone()
        .lerp(
          dayHorizon,
          daylight,
        )
        .lerp(
          sunsetHorizon,
          twilight * 0.72,
        );

    const ground =
      nightGround
        .clone()
        .lerp(
          dayGround,
          daylight,
        );

    this.skyMaterial
      .uniforms
      .zenithColor
      .value
      .copy(
        zenith,
      );

    this.skyMaterial
      .uniforms
      .upperColor
      .value
      .copy(
        upper,
      );

    this.skyMaterial
      .uniforms
      .horizonColor
      .value
      .copy(
        horizon,
      );

    this.skyMaterial
      .uniforms
      .groundHazeColor
      .value
      .copy(
        ground,
      );

    this.skyMaterial
      .uniforms
      .sunColor
      .value
      .setHex(
        twilight > 0.12
          ? 0xff9a65
          : 0xffe0ad,
      );

    this.skyMaterial
      .uniforms
      .sunWarmth
      .value =
      0.10 +
      twilight * 1.05 +
      daylight * 0.08;

    this.hemisphere.color
      .setHex(
        daylight > 0.5
          ? 0xb7ddff
          : 0x506487,
      );

    this.hemisphere
      .groundColor
      .setHex(
        daylight > 0.5
          ? 0x4c5547
          : 0x131a24,
      );

    this.hemisphere.intensity =
      0.16 +
      daylight * 1.12;

    this.sunLight.color
      .setHex(
        twilight > 0.12
          ? 0xffb27c
          : 0xfff0d5,
      );

    this.sunLight.intensity =
      daylight *
      (
        0.32 +
        Math.max(
          0,
          sunHeight,
        ) *
          1.38
      );

    this.moonLight.intensity =
      night * 0.20;

    const lightRadius =
      1800;

    this.sunLight.position.set(
      camera.position.x -
        sunHorizontal *
          lightRadius,

      camera.position.y +
        sunHeight *
          lightRadius,

      camera.position.z -
        900,
    );

    this.moonLight.position
      .copy(
        this.sunLight.position,
      )
      .multiplyScalar(-1);

    this.sunTarget.position
      .copy(
        camera.position,
      );

    this.sunTarget
      .updateMatrixWorld();

    const position =
      flight?.position ??
      camera.position;

    const terrain =
      safeHeight(
        this.sampleHeight,
        position.x,
        position.z,
      );

    const altitude =
      Math.max(
        0,
        position.y -
          terrain,
      );

    const altitudeFactor =
      clamp(
        altitude / 950,
        0,
        1,
      );

    const speedFactor =
      clamp(
        (
          getSpeed(flight) -
          45
        ) /
          180,
        0,
        1,
      );

    const desiredNear =
      520 +
      altitudeFactor * 680 +
      speedFactor * 120;

    const cameraFar =
      Number.isFinite(
        camera.far,
      )
        ? camera.far
        : 6200;

    const desiredFar =
      Math.min(
        cameraFar * 0.94,

        2300 +
          altitudeFactor *
            2400 +
          daylight * 900 +
          speedFactor * 180,
      );

    this.fogNear =
      damp(
        this.fogNear,
        desiredNear,
        1.7,
        safeDt,
      );

    this.fogFar =
      damp(
        this.fogFar,

        Math.max(
          this.fogNear +
            520,

          desiredFar,
        ),

        1.35,
        safeDt,
      );

    this.targetFogColor
      .copy(
        nightHorizon,
      )
      .lerp(
        dayHorizon,
        daylight,
      )
      .lerp(
        sunsetHorizon,
        twilight * 0.48,
      );

    this.fogColor.lerp(
      this.targetFogColor,

      1 -
        Math.exp(
          -1.25 *
          safeDt,
        ),
    );

    this.scene.fog.color
      .copy(
        this.fogColor,
      );

    this.scene.fog.near =
      this.fogNear;

    this.scene.fog.far =
      this.fogFar;

    this.hazeMaterial.color
      .copy(
        this.fogColor,
      );

    this.hazeMaterial.opacity =
      0.045 +
      (
        1 -
        altitudeFactor
      ) *
        0.07 +
      twilight * 0.035;

    const oceanDay =
      new THREE.Color(
        0x2e6c89,
      );

    const oceanNight =
      new THREE.Color(
        0x071525,
      );

    const oceanSunset =
      new THREE.Color(
        0x5c6471,
      );

    this.oceanMaterial.color
      .copy(
        oceanNight,
      )
      .lerp(
        oceanDay,
        daylight,
      )
      .lerp(
        oceanSunset,
        twilight * 0.34,
      );

    this.oceanMaterial.roughness =
      0.42 +
      night * 0.18;

    this._emitState(
      daylight,
      twilight,
      sunHeight,
    );
  }

  dispose() {
    globalThis.window
      ?.removeEventListener?.(
        'keydown',
        this._onKeyDown,
      );

    this.scene?.remove(
      this.skyRoot,
    );

    this.scene?.remove(
      this.ocean,
    );

    this.scene?.remove(
      this.hemisphere,
    );

    this.scene?.remove(
      this.sunLight,
    );

    this.scene?.remove(
      this.moonLight,
    );

    this.scene?.remove(
      this.sunTarget,
    );

    this.sky.geometry.dispose();
    this.skyMaterial.dispose();

    this.hazeRing
      .geometry
      .dispose();

    this.hazeMaterial.dispose();

    this.sun.geometry.dispose();
    this.sunMaterial.dispose();

    this.moon.geometry.dispose();
    this.moonMaterial.dispose();

    this.stars
      .geometry
      .dispose();

    this.stars
      .material
      .dispose();

    this.ocean
      .geometry
      .dispose();

    this.oceanMaterial.dispose();
  }
}
