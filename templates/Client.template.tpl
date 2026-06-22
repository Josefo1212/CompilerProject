import { ClientRSI } from './ClientRSI.js';

const main = async () =>{
    const client = new ClientRSI();
    try {
{{TEST_CALLS}}
    } catch(err) {
        console.error("Client error:", err);
    }
}

main();
