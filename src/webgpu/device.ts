import { GPUBuffer, GPUBufferUsageFlags, GPUDevice } from '@webgpu/types';

export class WebGPUDevice {
    public device: GPUDevice;
    
    static async init(): Promise<WebGPUDevice> {
        if (!navigator.gpu) {
            throw new Error('WebGPU not supported');
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error('No appropriate GPUAdapter found');
        }

        const device = await adapter.requestDevice();


        return new WebGPUDevice(device);
    }

    private constructor(device: GPUDevice) {
        this.device = device;
    }

    async createBuffer(data: Float32Array, usage: GPUBufferUsageFlags): Promise<GPUBuffer> {
        const buffer = this.device.createBuffer({
            size: data.byteLength,
            usage: usage,
            mappedAtCreation: true
        });

        new Float32Array(buffer.getMappedRange()).set(data);
        buffer.unmap();
        return buffer;
    }
}
