# How did we lose?

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Basketball fans who missed a game or are checking a box score and want to understand why their team lost. The user described mentally adding up shot attempts, rebounds, turnovers and free throws; this app makes that comparison quick and visible.

## Product Purpose

Choose an NBA game and a team, then see which box-score differences mattered most in equivalent points. The explanation should be readable at a glance, with the underlying calculation available when wanted.

## Positioning

An additive explanation of the scoring margin: ranked point costs and offsets reconcile to the actual score, instead of presenting another unweighted stats table.

## Capabilities and Constraints

- NBA is the confirmed first league.
- Live and completed games, historical dates, team perspective switching, source box scores and shared game links.
- Eight factors reconcile to the score margin. Turnovers and offensive rebounds allocate estimated shot opportunities; possession balance reconciles the remaining difference.
- What-if sliders illustrate closing accounting gaps, rather than predicting an alternate game.
- Real ESPN data; no invented game values or silent demo substitutions.
- Railway hosts the public app. Source lives in JickBick/how-did-we-lose on GitHub.
- React, TypeScript, Vite and Express are the existing stack. TanStack Query caches reads; Motion supplies interruptible interactions.

## Brand Commitments

The name is “How did we lose?”. The user likes the Apple-style interaction work but has rejected the generic dashboard appearance and asked for a design skill from an acclaimed GitHub repository to be saved and implemented. Retain the useful interaction quality while changing the composition and visual character.

## Evidence on Hand

Real NBA box scores from the API, source links, a tested scoring decomposition and browser captures in test-results. No testimonials, audience counts, commercial claims or player photography have been supplied.

## Product Principles

- Put the answer before supporting detail.
- Rank causes by equivalent-point impact, and make the running balance understandable.
- Count each scoring contribution once.
- Preserve team choice, clear data status and access to the explanation.
- Support quick use on a phone as well as closer inspection on a desktop.
