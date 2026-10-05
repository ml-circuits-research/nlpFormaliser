// Only the AMR method (see compare-evl-amr.mjs) — handy for running methods in parallel processes.
import config from "./compare-evl-amr.mjs";
export default (o) => config(o).filter((m) => m.name === "amr");
