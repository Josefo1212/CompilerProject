import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SDLCompiler {

    constructor(idlFile = 'greeter.sdl') {
        this.idlPath = join(process.cwd(), idlFile);
        this.templatesDir = join(__dirname, 'templates');
        this.outputDirs = {
            client: join(process.cwd(), 'client'),
            server: join(process.cwd(), 'server')
        };
    }

    applyTemplate(templateName, vars) {
        const tplPath = join(this.templatesDir, templateName);
        if (!existsSync(tplPath)) {
            throw new Error(`Template not found: ${tplPath}`);
        }
        let tpl = readFileSync(tplPath, 'utf-8');
        for (const [key, value] of Object.entries(vars)) {
            tpl = tpl.replaceAll(`{{${key}}}`, value);
        }
        return tpl;
    }

    compile() {
        try {
            console.log(`[🚀 COMPILER] Starting compilation from: ${this.idlPath}`);

            const metadata = this.parseSDL();
            this.prepareDirectories();
            this.generateArtifacts(metadata);

            console.log('\n[✨ SUCCESS] Distributed architecture generated successfully in /client and /server.');
        } catch (error) {
            console.error(`[❌ ERROR] Compilation failed: ${error.message}`);
        }
    }

    parseSDL() {
        if (!existsSync(this.idlPath)) {
            throw new Error(`Contract file "${this.idlPath}" not found.`);
        }

        const content = readFileSync(this.idlPath, 'utf-8');
        const lines = content.split(/\r?\n/).map(line => line.trim());

        let port = '';
        let className = '';
        const methods = [];

        for (const line of lines) {
            if (!line || line.startsWith('}')) continue;

            if (line.startsWith('@port:')) {
                port = line.split(':')[1]?.trim();
            } else if (line.startsWith('@class ')) {
                className = line.replace('@class ', '').replace('{', '').trim();
            } else if (line.startsWith('@method ')) {
                methods.push(this.extractMethodMetadata(line));
            }
        }

        if (!port || !className) {
            throw new Error('Invalid SDL format. Missing required directives (@port or @class).');
        }

        return { port, className, methods };
    }

    extractMethodMetadata(line) {
        const fullText = line.replace('@method ', '').trim();
        const [methodName, rawParams] = fullText.split('(');

        const parameters = rawParams
            ? rawParams.replace(')', '').split(',').map(p => p.trim()).filter(Boolean)
            : [];

        return {
            fullText,
            name: methodName.trim(),
            parameters
        };
    }

    prepareDirectories() {
        Object.values(this.outputDirs).forEach(dir => {
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
        });
    }

    generateArtifacts(metadata) {
        const { className } = metadata;
        const { client: clientDir, server: serverDir } = this.outputDirs;

        const proxyMethods = metadata.methods.map(m => {
            return `    ${m.name}(${m.parameters.join(', ')}) {\n        throw new Error("Abstract method: ${m.name} must be implemented in ClientRSI");\n    }`;
        }).join('\n\n');

        const codeProxy = this.applyTemplate('Proxy.template.tpl', {
            CLASS_NAME: className,
            PROXY_METHODS: proxyMethods,
        });

        const clientMethods = metadata.methods.map(m => {
            const paramList = m.parameters.join(', ');
            const argsArray = m.parameters.length > 0 ? paramList : '';
            return (
                `    async ${m.name}(${paramList}) {
        return this._sendRequest('${m.name}', ${argsArray});
    }`
            );
        }).join('\n\n');

        const codeClientRSI = this.applyTemplate('ClientRSI.template.tpl', {
            CLASS_NAME: className,
            PORT: metadata.port,
            CLIENT_METHODS: clientMethods,
        });

        const testCalls = metadata.methods.map(m => {
            const defaultArgs = m.parameters.map(p => `"test_${p}"`).join(', ');
            return `        const res_${m.name} = await client.${m.name}(${defaultArgs});\n        console.log("Result for ${m.name}:", res_${m.name});`;
        }).join('\n');

        const codeClientScript = this.applyTemplate('Client.template.tpl', {
            CLASS_NAME: className,
            TEST_CALLS: testCalls,
        });

        const serverMethods = metadata.methods.map(m => {
            return (
                `                        case '${m.name}': {
                            const result = await this.service.${m.name}(...args);
                            socket.write(\`SUCCESS|\${result}\`);
                            break;
                        }`
            );
        }).join('\n');

        const codeServerRSI = this.applyTemplate('ServerRSI.template.tpl', {
            CLASS_NAME: className,
            PORT: metadata.port,
            SERVER_METHODS: serverMethods,
        });

        const serviceMethods = metadata.methods.map(m => {
            return `    ${m.name}(${m.parameters.join(', ')}) {\n        console.log("Executing ${m.name} with:", ${m.parameters.length ? m.parameters.join(', ') : 'null'});\n        return "Hello from Server for: ${m.name}";\n    }`;
        }).join('\n\n');

        const codeService = this.applyTemplate('Service.template.tpl', {
            CLASS_NAME: className,
            SERVICE_METHODS: serviceMethods,
        });

        const codeServerMain = this.applyTemplate('Server.template.tpl', {
            CLASS_NAME: className,
        });

        const writeUTF8 = (path, content) => writeFileSync(path, content, 'utf-8');

        writeUTF8(join(clientDir, `Client.js`), codeClientScript);
        writeUTF8(join(clientDir, `Proxy.js`), codeProxy);
        writeUTF8(join(clientDir, `ClientRSI.js`), codeClientRSI);

        writeUTF8(join(serverDir, `Server.js`), codeServerMain);
        writeUTF8(join(serverDir, `ServerRSI.js`), codeServerRSI);
        writeUTF8(join(serverDir, `Service.js`), codeService);
    }
}

const compiler = new SDLCompiler('greeter.sdl');
compiler.compile();
