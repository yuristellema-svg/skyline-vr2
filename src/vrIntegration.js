// SKYLINE_V53B_MENU_AUDIO
import * as THREE from '../vendor/three.module.min.js';
import { installIosAudioBridge } from './iosAudioBridge.js';
import { ReliableFlightAudio } from './reliableFlightAudio.js';

const DEFAULT_SEAT =
  new THREE.Vector3(
    0,
    0.62,
    -0.18,
  );

function asVector3(
  value,
  target,
) {
  if (!value) return false;

  if (value.isVector3) {
    target.copy(value);
    return true;
  }

  if (Array.isArray(value)) {
    target.fromArray(value);
    return true;
  }

  if (
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z)
  ) {
    target.set(
      value.x,
      value.y,
      value.z,
    );

    return true;
  }

  if (value.position) {
    return asVector3(
      value.position,
      target,
    );
  }

  return false;
}

function setGauge(
  gauge,
  value,
  minimumAngle,
  maximumAngle,
) {
  if (!gauge) return;

  if (
    typeof gauge.setValue ===
    'function'
  ) {
    gauge.setValue(value);
    return;
  }

  const needle =
    gauge.userData?.needle ??
    gauge.needle ??
    gauge.pointer ??
    null;

  if (!needle?.rotation) return;

  const normalized =
    THREE.MathUtils.clamp(
      value,
      0,
      1,
    );

  needle.rotation.z =
    THREE.MathUtils.lerp(
      minimumAngle,
      maximumAngle,
      normalized,
    );
}

class SkylineVrIntegration {
  constructor({
    aircraftVisuals,
    cameraRig,
    stereo,
    worldPolish,
    input,
    menu,
  }) {
    this.aircraftVisuals =
      aircraftVisuals;

    this.cameraRig =
      cameraRig;

    this.stereo =
      stereo;

    this.worldPolish =
      worldPolish;

    this.iosAudioBridge =
      installIosAudioBridge(
        worldPolish,
      );


    this.input =
      input;

    this.menu =
      menu;

    this.phoneMode = false;

    // SKYLINE_V53_MENU_AUDIO_FIX
    this.fallbackAudio =
      new ReliableFlightAudio();

    this.originalWorldUpdate =
      worldPolish.update.bind(
        worldPolish,
      );

    worldPolish.update =
      (
        dt,
        flight,
        camera,
        phase = 'flying',
      ) => {
        const result =
          this.originalWorldUpdate(
            dt,
            flight,
            camera,
            phase,
          );

        /*
         * Audio is presentation-only.
         * It runs after the protected world
         * update and cannot change physics.
         */
        try {
          this.fallbackAudio.update(
            dt,
            flight,
            camera,
            phase,
          );
        } catch (error) {
          console.warn(
            '[Skyline] Fallback audio update skipped',
            error,
          );
        }

        return result;
      };
    this.anchorValid = false;

    this.anchorQuaternion =
      new THREE.Quaternion();

    this.tempSeat =
      new THREE.Vector3();

    this.tempWorld =
      new THREE.Vector3();

    this.lastCockpitModel =
      null;

    this.lastPose =
      null;

    this.lastUnlockTime =
      -Infinity;

    this.originalAircraftUpdate =
      aircraftVisuals.update
        .bind(aircraftVisuals);

    this.originalAircraftAttach =
      aircraftVisuals.attach
        ?.bind(aircraftVisuals);

    this.originalRenderEye =
      stereo._renderEye
        .bind(stereo);

    this.originalSetStereo =
      stereo.setStereo
        .bind(stereo);

    this.originalInputSample =
      input.sampleFlightControls
        .bind(input);

    this._moveCockpitIntoWorld();

    aircraftVisuals.attach =
      camera => {
        aircraftVisuals.camera =
          camera;

        this._moveCockpitIntoWorld();
      };

    aircraftVisuals.update =
      (
        dt,
        pose,
        cameraMode,
      ) => {
        this.originalAircraftUpdate(
          dt,
          pose,
          cameraMode,
        );

        this._afterAircraftUpdate(
          pose,
          cameraMode,
        );
      };

    stereo._renderEye =
      (
        worldScene,
        eyeCamera,
        x,
        y,
        width,
        height,
      ) => {
        this._applyAircraftReticle();

        return this.originalRenderEye(
          worldScene,
          eyeCamera,
          x,
          y,
          width,
          height,
        );
      };

    stereo.setStereo =
      enabled => {
        this.originalSetStereo(enabled);
        this.setPhoneMode(
          Boolean(enabled),
        );
      };

    input.sampleFlightControls =
      dt => {
        this.originalInputSample(dt);

        if (
          input.mode === 'phone'
        ) {
          /*
           * Keep unrestricted head yaw,
           * but reduce aircraft steering
           * sensitivity on the phone.
           */
          input.controls.pitchRate *=
            0.78;

          input.controls.rollRate *=
            0.74;
        }
      };

    this.unlockHandler =
      () => {
        const now =
          performance.now();

        if (
          now -
            this.lastUnlockTime <
          180
        ) {
          return;
        }

        this.lastUnlockTime =
          now;

        this.unlockAudioFromGesture();
      };

    for (
      const element of
      [
        document.querySelector(
          '#phone-start',
        ),
        document.querySelector(
          '#desktop-start',
        ),
      ]
    ) {
      if (!element) continue;

      element.addEventListener(
        'pointerdown',
        this.unlockHandler,
        {
          capture: true,
          passive: true,
        },
      );

      element.addEventListener(
        'touchstart',
        this.unlockHandler,
        {
          capture: true,
          passive: true,
        },
      );
    }

    /*
     * Safari may accept audio activation on
     * touchend/click rather than pointerdown.
     * Listen to every genuine interaction.
     */
    for (
      const eventName of
      [
        'pointerup',
        'touchend',
        'click',
        'keydown',
      ]
    ) {
      window.addEventListener(
        eventName,
        this.unlockHandler,
        {
          capture: true,
          passive: true,
        },
      );
    }

    this.resumeHandler =
      () => {
        this.resumeAudio();
      };

    document.addEventListener(
      'visibilitychange',
      this.resumeHandler,
    );

    window.addEventListener(
      'pageshow',
      this.resumeHandler,
    );
  }

  _moveCockpitIntoWorld() {
    const root =
      this.aircraftVisuals
        ?.cockpitRoot;

    if (!root) return;

    if (
      root.parent !==
      this.aircraftVisuals.scene
    ) {
      root.parent?.remove(root);

      this.aircraftVisuals
        .scene
        ?.add(root);
    }

    root.position.set(
      0,
      0,
      0,
    );

    root.quaternion.identity();
  }

  _resolveSeat(model) {
    const candidate =
      model?.userData
        ?.seatTransform ??
      model?.userData
        ?.pilotEye ??
      model?.userData
        ?.seat ??
      null;

    if (!candidate) {
      return null;
    }

    if (
      candidate.isObject3D &&
      typeof candidate
        .getWorldPosition ===
        'function'
    ) {
      this.aircraftVisuals
        .cockpitRoot
        .updateMatrixWorld(true);

      candidate.getWorldPosition(
        this.tempWorld,
      );

      this.aircraftVisuals
        .cockpitRoot
        .worldToLocal(
          this.tempWorld,
        );

      return this.tempSeat.copy(
        this.tempWorld,
      );
    }

    if (
      asVector3(
        candidate,
        this.tempSeat,
      )
    ) {
      return this.tempSeat;
    }

    return null;
  }

  _prepareCockpitModel() {
    const model =
      this.aircraftVisuals
        ?.cockpitModel;

    if (
      !model ||
      model ===
        this.lastCockpitModel
    ) {
      return;
    }

    this.lastCockpitModel =
      model;

    const explicitSeat =
      this._resolveSeat(model);

    if (explicitSeat) {
      this.cameraRig
        ._firstOffset
        ?.copy(explicitSeat);
    } else {
      this.cameraRig
        ._firstOffset
        ?.copy(DEFAULT_SEAT);

      /*
       * Older cockpit models were built
       * relative to the camera itself.
       * Move those once into aircraft space.
       */
      if (
        !model.userData
          .skylineWorldMounted
      ) {
        model.position.add(
          DEFAULT_SEAT,
        );
      }
    }

    model.userData
      .skylineWorldMounted =
      true;
  }

  _afterAircraftUpdate(
    pose,
    cameraMode,
  ) {
    if (!pose?.position) return;

    const attitude =
      pose.attitude ??
      pose.quaternion;

    if (!attitude?.isQuaternion) {
      return;
    }

    this.lastPose = pose;

    this._moveCockpitIntoWorld();
    this._prepareCockpitModel();

    const root =
      this.aircraftVisuals
        .cockpitRoot;

    root.position.copy(
      pose.position,
    );

    root.quaternion.copy(
      attitude,
    );

    root.visible =
      cameraMode ===
      'cockpit';

    this.anchorQuaternion.copy(
      attitude,
    );

    this.anchorValid = true;

    this._updateNamedInstruments(
      pose,
    );
  }

  _updateNamedInstruments(
    pose,
  ) {
    const instruments =
      this.aircraftVisuals
        ?.cockpitModel
        ?.userData
        ?.instruments;

    if (
      !instruments ||
      Array.isArray(
        instruments,
      )
    ) {
      return;
    }

    const speed =
      Math.max(
        0,
        Number(pose.speed) ||
          pose.velocity
            ?.length?.() ||
          0,
      );

    const altitude =
      Math.max(
        0,
        Number(
          pose.position?.y,
        ) || 0,
      );

    setGauge(
      instruments.airspeed ??
        instruments.speed ??
        instruments.ias,
      speed / 240,
      -2.25,
      2.25,
    );

    setGauge(
      instruments.altitude ??
        instruments.altimeter ??
        instruments.alt,
      altitude / 3200,
      -2.35,
      2.35,
    );

    setGauge(
      instruments.rpm ??
        instruments.engine,
      speed / 180,
      -2.15,
      2.15,
    );
  }

  _applyAircraftReticle() {
    if (
      !this.anchorValid ||
      this.menu?.isOpen
    ) {
      return;
    }

    const reticle =
      this.stereo?.reticle;

    const offset =
      this.stereo
        ?._reticleWorldOffset;

    const localOffset =
      this.stereo
        ?._reticleOffset;

    if (
      !reticle ||
      !offset ||
      !localOffset
    ) {
      return;
    }

    /*
     * Position starts at the actual
     * camera seat, but orientation stays
     * aircraft-forward. Looking sideways
     * therefore moves the sight away from
     * screen centre instead of dragging it
     * with the user's head.
     */
    offset
      .copy(localOffset)
      .applyQuaternion(
        this.anchorQuaternion,
      );

    reticle.position
      .copy(
        this.cameraRig
          .basePosition,
      )
      .add(offset);

    reticle.quaternion.copy(
      this.anchorQuaternion,
    );

    reticle.updateMatrixWorld(
      true,
    );
  }

  _disableExistingAudio() {
    if (
      this._existingAudioDisabled
    ) {
      return;
    }

    const optionalWorld =
      this.worldPolish
        ?.optionalWorld ??
      this.worldPolish;

    const owner =
      optionalWorld
        ?.registry
        ?.get?.('audio') ??
      optionalWorld?.audio ??
      null;

    if (!owner) {
      return;
    }

    const candidates =
      new Set([
        owner,
        owner?.audio,
        owner?.engine,
        owner?.runtime,
      ].filter(Boolean));

    for (
      const candidate of
      candidates
    ) {
      try {
        candidate.dispose?.();
      } catch {
        // Replacement audio remains isolated.
      }

      try {
        candidate.update =
          () => undefined;

        candidate.playBoost =
          () => undefined;

        candidate.disabled = true;
      } catch {
        // A frozen object can be ignored.
      }
    }

    this._existingAudioDisabled =
      true;

    console.info(
      '[Skyline] Package audio replaced by reliable iOS audio runtime',
    );
  }

  _audioCandidates() {
    const optionalWorld =
      this.worldPolish
        ?.optionalWorld ??
      this.worldPolish;

    const owner =
      optionalWorld
        ?.registry
        ?.get?.('audio') ??
      optionalWorld?.audio ??
      null;

    return [
      owner,
      owner?.audio,
      owner?.engine,
      owner?.runtime,
    ].filter(Boolean);
  }

  unlockAudioFromGesture() {
    /*
     * Build and start the graph directly
     * inside the trusted iPhone gesture.
     */
    const fallbackStarted =
      this.fallbackAudio
        ?.unlockFromGesture?.();

    if (fallbackStarted) {
      this._disableExistingAudio();
      return true;
    }

    /*
     * Emergency compatibility path for
     * browsers where fallback Web Audio is
     * unavailable.
     */
    let attempted = false;

    for (
      const candidate of
      this._audioCandidates()
    ) {
      for (
        const method of
        [
          'unlockFromGesture',
          'unlock',
          'resumeFromGesture',
          'resume',
          'start',
        ]
      ) {
        if (
          typeof candidate[
            method
          ] !== 'function'
        ) {
          continue;
        }

        attempted = true;

        try {
          const result =
            candidate[
              method
            ]();

          result?.catch?.(
            () => {},
          );
        } catch (error) {
          console.warn(
            '[Skyline] Package audio unlock failed',
            error,
          );
        }
      }
    }

    return attempted;
  }

  resumeAudio() {
    if (
      document.visibilityState &&
      document.visibilityState !==
        'visible'
    ) {
      return;
    }

    if (
      this.fallbackAudio
        ?.resume?.()
    ) {
      return;
    }

    for (
      const candidate of
      this._audioCandidates()
    ) {
      try {
        if (
          typeof candidate
            .resume ===
          'function'
        ) {
          candidate
            .resume()
            ?.catch?.(
              () => {},
            );
        }

        const context =
          candidate.context ??
          candidate.audioContext ??
          candidate.audio?.context;

        if (
          context &&
          context.state !== 'running'
        ) {
          context
            .resume()
            ?.catch?.(
              () => {},
            );
        }
      } catch {
        /*
         * Audio may never interrupt
         * rendering or flight physics.
         */
      }
    }
  }

  setPhoneMode(enabled) {
    this.phoneMode =
      Boolean(enabled);

    if (!this.phoneMode) {
      return;
    }

    /*
     * Phone VR should place the player
     * inside the cockpit, not in the clean
     * camera-only first-person mode.
     */
    this.cameraRig.setMode(
      'cockpit',
    );
  }
}

export function installSkylineVrIntegration(
  options,
) {
  return new SkylineVrIntegration(
    options,
  );
}
