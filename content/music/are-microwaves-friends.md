---
title: Are Microwaves Friends?
date: 2020-09-20T00:00:00.000Z
subcategory: Sonic Pi experiments
---

My first experiment with Sonic Pi was all craft, no art, I’d say. The idea was to create a cover of *No Surprises* by Radiohead, the aim was to study arrangement, the result was a lullabylike rendition of the Radiohead classic, a successful experiment by my defined criteria. What I wanted to do next, in experiment no. 2, was use Sonic Pi for composition.

#### The purpose of this experiment
This time, the idea was as much craft as earlier, but a little more art. The idea was to a. see if I could compose an entire track on Sonic Pi, and b. see how easy or difficult such composition was.

#### The track itself

I set out to compose a minimal house track, Since I wasn’t a huge fan of the preloaded drum samples, I loaded some 808 and 909 drum samples to build the percussive spine of the track. For the bass and melodies, I used the preloaded synths. It was really easy to compose, to be honest, a lot easier than I thought it would be.

#### Conclusions
The challenge however is that there’s a limited buffer size, so I couldn’t complete the whole track, seeing as my file just ran into a character limit. To extend the track beyond its 2:30 minute run, I’ll have to program the rest of the track on a separate file. Either that, or use *live_loops*, which appear to be way more economical in terms of characters used. I use functions and not *live_loops*, because my composition process is not driven by live performance. Compositionally, changing my thinking from what it is now to a performance-based approach will likely make ‘my sound’ evolve in a way that might be interesting.

Next step: continuing work on this track as a series of loops. It’s also, on a side note, how I suspect this thing was intended to be used, hence the focus on ‘**live** coding’.

#### The code
Here’s the code I used to make this with the pathnames to my drum samples knocked off.
