<script setup>
import { TooltipTrigger, useForwardProps } from "reka-ui";

const props = defineProps({
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  reference: { type: null, required: false },
});

const forwardedProps = useForwardProps(props);
</script>

<template>
  <TooltipTrigger data-slot="tooltip-trigger" v-bind="forwardedProps">
    <slot />
  </TooltipTrigger>
</template>
