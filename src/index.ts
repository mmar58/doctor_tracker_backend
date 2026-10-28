import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createDB } from "./db/index.js";

async function start() {
    try {
        await createDB();
        const app = createApp();

        app.listen(env.PORT, () => {
            console.log(`Server is running on port ${env.PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

start();
