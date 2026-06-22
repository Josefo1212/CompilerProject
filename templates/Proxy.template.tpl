export class Proxy {
    constructor() {
        if (new.target === Proxy) {
            throw new TypeError("Cannot instantiate Proxy directly (abstract class)");
        }
    }

{{PROXY_METHODS}}
}
