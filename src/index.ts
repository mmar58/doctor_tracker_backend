import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
    console.log(`Server is running on port ${env.PORT}`);
});