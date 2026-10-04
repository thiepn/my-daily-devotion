import { browserShards } from "./certification/evidence.mjs";
import { buildStage, finishStage, fullStage, shardStage } from "./certification/runner.mjs";

const stage = process.argv[2] ?? "full";
if (stage === "matrix") console.log(JSON.stringify({ include: browserShards }));
else if (stage === "build") await buildStage();
else if (stage === "shard") await shardStage(process.argv[3]);
else if (stage === "finish") await finishStage();
else if (stage === "full") await fullStage();
else throw new Error(`Unknown certification stage: ${stage}`);
