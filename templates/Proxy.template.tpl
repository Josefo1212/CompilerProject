const NativeProxy = globalThis.Proxy;

export class Proxy {
    constructor() {
        return new NativeProxy(this, {
            get(target, prop) {
                if (prop in target) return target[prop];
                return (...args) => target._sendRequest(prop, ...args);
            }
        });
    }
}
