import { emitter } from "../../lib/emitter.js";

import main from "./poll.js";

emitter.on("init", () => {
    main();
});