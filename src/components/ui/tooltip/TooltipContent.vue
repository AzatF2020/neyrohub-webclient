<script setup>
import { reactiveOmit } from "@vueuse/core";
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  useForwardPropsEmits,
} from "reka-ui";
import { cn } from "@/lib/utils";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps({
  forceMount: { type: Boolean, required: false },
  ariaLabel: { type: String, required: false },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  side: { type: String, required: false, default: "top" },
  sideOffset: { type: Number, required: false, default: 6 },
  align: { type: String, required: false },
  alignOffset: { type: Number, required: false },
  avoidCollisions: { type: Boolean, required: false, default: true },
  collisionBoundary: { type: null, required: false },
  collisionPadding: { type: [Number, Object], required: false, default: 8 },
  sticky: { type: String, required: false },
  hideWhenDetached: { type: Boolean, required: false },
  positionStrategy: { type: String, required: false },
  updatePositionStrategy: { type: String, required: false },
  disableUpdateOnLayoutShift: { type: Boolean, required: false },
  prioritizePosition: { type: Boolean, required: false },
  reference: { type: null, required: false },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
  showArrow: { type: Boolean, required: false, default: true },
});

const emits = defineEmits(["escapeKeyDown", "pointerDownOutside"]);

const delegatedProps = reactiveOmit(props, "class", "showArrow");

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      data-slot="tooltip-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/10 z-50 w-fit max-w-64 rounded-md px-2.5 py-1 text-xs shadow-md ring-1 duration-150',
          props.class,
        )
      "
    >
      <slot />
      <TooltipArrow v-if="showArrow" class="z-50 size-2 fill-popover" :width="8" :height="4" />
    </TooltipContent>
  </TooltipPortal>
</template>
