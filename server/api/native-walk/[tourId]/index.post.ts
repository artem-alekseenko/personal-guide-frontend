import { forwardNativeWalk } from "../../../utils/nativeWalk";
export default defineEventHandler((event) =>
  forwardNativeWalk(event, "POST", ""),
);
