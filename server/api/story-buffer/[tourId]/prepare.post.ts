import { forwardStoryBuffer } from "../../../utils/storyBuffer";
export default defineEventHandler((event) =>
  forwardStoryBuffer(event, "prepare"),
);
