import React, { useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "motion/react";
import { storage } from "../utils/localStorage";

const FALLBACK_STORY_STEPS = [
  {
    title: "Our Story.",
    subtitle: "Design Sketching",
    description: "From the world's finest mills to your wardrobe. A journey of uncompromising quality, expert craftsmanship, and timeless design.",
    image: "https://images.unsplash.com/photo-1542060748-10c28b62716f?q=80&w=1600&auto=format&fit=crop&sat=-100&con=20"
  },
  {
    title: "Global Sourcing",
    subtitle: "01 / Premium Fabric",
    description: "We import premium fabrics from across the entire world, meticulously selecting only the finest materials.",
    image: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?q=80&w=1600&auto=format&fit=crop&sat=-100&con=20"
  },
  {
    title: "Fabric Finishing",
    subtitle: "02 / Treatment",
    description: "Each fabric undergoes specialized finishing processes, enhancing its natural texture, drape, and longevity.",
    image: "https://images.unsplash.com/photo-1612423284934-2850a4ea6b0f?q=80&w=1600&auto=format&fit=crop&sat=-100&con=20"
  },
  {
    title: "Personalized Sketching",
    subtitle: "03 / Design",
    description: "Our master designers sketch personalized, bespoke designs, translating your vision into detailed sartorial blueprints.",
    image: "https://images.unsplash.com/photo-1549388604-817d15aa0110?q=80&w=1600&auto=format&fit=crop&sat=-100&con=20"
  },
  {
    title: "Expert Craftsmanship",
    subtitle: "04 / Tailoring",
    description: "Master tailors bring designs to life with traditional techniques refined over generations.",
    image: "https://images.unsplash.com/photo-1607083206968-13611e3d76db?q=80&w=1600&auto=format&fit=crop&sat=-100&con=20"
  },
  {
    title: "Ready For You",
    subtitle: "05 / Box Packing",
    description: "The journey concludes with the ready-to-stitch fabric elegantly folded and secured in our premium box packing.",
    image: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=1600&auto=format&fit=crop&sat=-100&con=20"
  }
];

export default function HomeOurStorySection() {
  const storyRef = useRef(null);
  const [activeStoryStep, setActiveStoryStep] = useState(0);

  const siteContent = storage.getSiteContent();
  const siteStorySteps = siteContent && siteContent.homepage && siteContent.homepage.storySteps;
  
  const STORY_STEPS = (siteStorySteps && siteStorySteps.length > 0)
    ? siteStorySteps
    : FALLBACK_STORY_STEPS;

  const { scrollYProgress: storyScrollY } = useScroll({
    target: storyRef,
    offset: ["start start", "end end"]
  });

  useMotionValueEvent(storyScrollY, "change", (latest) => {
    const step = Math.min(Math.floor(latest * STORY_STEPS.length), STORY_STEPS.length - 1);
    if (step !== activeStoryStep) {
      setActiveStoryStep(step);
    }
  });

  const currentStep = STORY_STEPS[activeStoryStep];
  const isFirst = activeStoryStep === 0;

  return React.createElement(
    "section",
    { ref: storyRef, className: "bg-brand-bg relative h-[300vh]" },
    React.createElement(
      "div",
      { className: "sticky top-0 h-screen w-full overflow-hidden flex flex-col" },
      // Desktop layout
      React.createElement(
        "div",
        { className: "hidden md:flex max-w-[1400px] mx-auto w-full h-full items-center px-6 md:px-12" },
        // Left: image
        React.createElement(
          "div",
          { className: "w-1/2 h-full flex items-center justify-center p-12" },
          React.createElement(
            "div",
            { className: "w-full max-w-md aspect-[3/4] relative" },
            React.createElement(
              AnimatePresence,
              { mode: "wait" },
              React.createElement(motion.img, {
                key: activeStoryStep,
                src: currentStep.image,
                initial: { opacity: 0, filter: "blur(10px)", scale: 0.95 },
                animate: { opacity: 1, filter: "blur(0px)", scale: 1 },
                exit: { opacity: 0, filter: "blur(10px)", scale: 1.05 },
                transition: { duration: 0.6, ease: "easeInOut" },
                className: "absolute inset-0 w-full h-full object-cover shadow-2xl",
                referrerPolicy: "no-referrer"
              })
            ),
            React.createElement("div", {
              className: "absolute inset-0 border border-brand-black/5 pointer-events-none"
            })
          )
        ),
        // Right: text
        React.createElement(
          "div",
          { className: "w-1/2 relative h-[60vh] flex items-center pl-16" },
          React.createElement(
            AnimatePresence,
            { mode: "wait" },
            React.createElement(
              motion.div,
              {
                key: activeStoryStep,
                initial: { opacity: 0, y: 40 },
                animate: { opacity: 1, y: 0 },
                exit: { opacity: 0, y: -40 },
                transition: { duration: 0.5, ease: "easeOut" },
                className: "absolute w-full pr-12"
              },
              React.createElement(
                "div",
                { className: "absolute -left-8 -top-20 text-[180px] lg:text-[220px] font-display text-brand-black/[0.03] font-bold pointer-events-none select-none leading-none z-0" },
                isFirst ? "EST" : ("0" + activeStoryStep)
              ),
              React.createElement(
                "div",
                { className: "relative z-10" },
                React.createElement(
                  "div",
                  { className: "flex items-center gap-4 mb-8" },
                  React.createElement("span", { className: "w-12 h-[1px] bg-brand-secondary/50" }),
                  React.createElement(
                    "span",
                    { className: "text-[10px] uppercase tracking-[0.4em] font-bold text-brand-secondary" },
                    currentStep.subtitle
                  )
                ),
                React.createElement(
                  "h3",
                  { className: "text-4xl lg:text-6xl font-display tracking-tight text-brand-black mb-8 leading-[1.1]" },
                  isFirst
                    ? React.createElement("span", { className: "font-bold text-brand-black" }, "Our Story.")
                    : currentStep.title
                ),
                React.createElement(
                  "p",
                  { className: "text-lg text-brand-secondary/80 font-light leading-relaxed max-w-md" },
                  currentStep.description
                )
              )
            )
          )
        )
      ),
      // Mobile layout
      React.createElement(
        "div",
        { className: "md:hidden w-full h-full flex flex-col relative bg-brand-bg pt-16" },
        React.createElement(
          "div",
          { className: "h-[40vh] w-full relative px-6 flex items-center justify-center" },
          React.createElement(
            AnimatePresence,
            { mode: "wait" },
            React.createElement(motion.img, {
              key: activeStoryStep,
              src: currentStep.image,
              initial: { opacity: 0, filter: "blur(10px)", scale: 0.95 },
              animate: { opacity: 1, filter: "blur(0px)", scale: 1 },
              exit: { opacity: 0, filter: "blur(10px)", scale: 1.05 },
              transition: { duration: 0.6, ease: "easeInOut" },
              className: "absolute inset-0 w-full h-full object-cover p-4",
              referrerPolicy: "no-referrer"
            })
          )
        ),
        React.createElement(
          "div",
          { className: "h-[60vh] w-full relative px-6 pt-8" },
          React.createElement(
            AnimatePresence,
            { mode: "wait" },
            React.createElement(
              motion.div,
              {
                key: activeStoryStep,
                initial: { opacity: 0, x: 20 },
                animate: { opacity: 1, x: 0 },
                exit: { opacity: 0, x: -20 },
                transition: { duration: 0.4, ease: "easeOut" },
                className: "absolute w-[calc(100%-3rem)]"
              },
              React.createElement(
                "span",
                { className: "text-[10px] uppercase tracking-[0.4em] font-bold text-brand-secondary mb-3 block" },
                currentStep.subtitle
              ),
              React.createElement(
                "h3",
                { className: "text-3xl font-display tracking-tight text-brand-black mb-3" },
                isFirst
                  ? React.createElement("span", { className: "font-bold text-brand-black" }, "Our Story.")
                  : currentStep.title
              ),
              React.createElement(
                "p",
                { className: "text-sm text-brand-secondary/80 font-light leading-relaxed mb-4" },
                currentStep.description
              )
            )
          )
        )
      )
    )
  );
}
