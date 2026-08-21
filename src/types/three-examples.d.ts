declare module "three/examples/jsm/loaders/GLTFLoader" {
  import { Loader } from "three";
  export class GLTFLoader extends Loader {
    constructor(manager?: any);
    load(url: string, onLoad: (gltf: any) => void, onProgress?: any, onError?: (error: Error) => void): void;
    parse(data: ArrayBuffer | string, path: string, onLoad: (gltf: any) => void, onError?: (error: Error) => void): void;
  }
  export default GLTFLoader;
}

declare module "three/examples/jsm/renderers/CSS2DRenderer" {
  import { Camera, Object3D, Scene } from "three";
  export class CSS2DObject extends Object3D {
    constructor(element?: HTMLElement);
    element: HTMLElement;
  }
  export class CSS2DRenderer {
    constructor(parameters?: { element?: HTMLElement });
    domElement: HTMLElement;
    setSize(width: number, height: number): void;
    render(scene: Scene, camera: Camera): void;
  }
}

declare module "postprocessing" {
  import { Camera, WebGLRenderer } from "three";
  export class EffectComposer {
    constructor(renderer?: WebGLRenderer, options?: object);
    addPass(pass: unknown): void;
    setSize(width: number, height: number): void;
    render(deltaTime?: number): void;
    dispose(): void;
  }
  export class RenderPass {
    constructor(scene?: unknown, camera?: Camera, options?: object);
  }
  export class EffectPass {
    constructor(camera?: Camera, ...effects: unknown[]);
  }
  export class BloomEffect {
    constructor(options?: {
      intensity?: number;
      luminanceThreshold?: number;
      luminanceSmoothing?: number;
      mipmapBlur?: boolean;
    });
  }
}

declare module "three/examples/jsm/postprocessing/UnrealBloomPass" {
  import { Vector2 } from "three";
  import { Pass } from "three/examples/jsm/postprocessing/Pass.js";
  export class UnrealBloomPass extends Pass {
    constructor(resolution: Vector2, strength?: number, radius?: number, threshold?: number);
    strength: number;
    radius: number;
    threshold: number;
  }
}

declare module "three/examples/jsm/controls/OrbitControls" {
  import { Camera, Vector3 } from "three";
  export class OrbitControls {
    constructor(object: Camera | any, domElement?: HTMLElement);
    update(): void;
    dispose(): void;
    target: Vector3;
    enabled: boolean;
    enableDamping: boolean;
    dampingFactor: number;
    enablePan: boolean;
    enableZoom: boolean;
    enableRotate: boolean;
    /** 是否开启屏幕空间平移模式 (true 为沿屏幕平移，false 为沿正交平面平移) */
    screenSpacePanning: boolean;
    minDistance?: number;
    maxDistance?: number;
    minPolarAngle?: number;
    maxPolarAngle?: number;
    getPolarAngle(): number;
    getAzimuthalAngle(): number;
    addEventListener(type: string, listener: (event: any) => void): void;
  }
  export default OrbitControls;
}
