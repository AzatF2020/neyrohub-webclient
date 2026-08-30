<script setup>
import { TooltipProvider, TooltipRoot, useForwardPropsEmits } from "reka-ui";
import { reactiveOmit } from "@vueuse/core";

const props = defineProps({
  defaultOpen: { type: Boolean, required: false },
  open: { type: Boolean, required: false },
  delayDuration: { type: Number, required: false, default: 200 },
  disableHoverableContent: { type: Boolean, required: false },
  disableClosingTrigger: { type: Boolean, required: false },
  disabled: { type: Boolean, required: false },
  ignoreNonKeyboardFocus: { type: Boolean, required: false },
});

const emits = defineEmits(["update:open"]);

const delegatedProps = reactiveOmit(props, "delayDuration");

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <!-- Провайдер внутри: тултипы стоят по одному у своего контрола, общей обёртки в приложении нет -->
  <TooltipProvider :delay-duration="props.delayDuration">
    <TooltipRoot v-bind="forwarded">
      <slot />
    </TooltipRoot>
  </TooltipProvider>
</template>
