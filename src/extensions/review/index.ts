import { emitter } from "../../lib/emitter.js";
import main from "./arcade_review.js";

emitter.on("init", () => {
    main();
});