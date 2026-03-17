---
title: No Surprises
date: 2020-09-10T00:00:00.000Z
subcategory: Sonic Pi experiments
---

#### The purpose of this experiment.
To see how easy it was to arrange *No Surprises* by Radiohead on Sonic Pi. 

Every exploration has to start somewhere and my exploration of Sonic Pi has started with what I would classify as a successful attempt at coding a cover of *No Surprises*. Why *No Surprises*? Because I like it. And Sonic Pi’s default keys reminded me of the keys on the intro of the song.

#### The track itself

Structurally, *No Surprises* is fairly straightforward. Of course, there’s a lot of nuance when it’s performed on ‘real instruments’, but at it’s core, it’s an intro that leads to a long verse that leads to a chorus, then a shorter verse that leads to the second chorus, then a bridge, followed by a final verse and chorus. Musically, therefore, there were only these parts to consider while writing the code:

- the intro

- the verse

- the chorus

- the bridge

Ideally, I planned to write a function for each of these, then just call them in order, but since these are basically my first few hours writing on Sonic Pi (and my first few hours writing any non SQL, no web development code in several years), I ended up writing some filthy mish-mash of smaller functions. But it’s functional and is pasted at the end of this.

#### Conclusions
The purpose of Sonic Pi isn’t to cover Radiohead. It would be much easier to do that with on Logic Pro or any other digital audio workstation (DAW). Besides, what is MIDI but a no-code layer on top of code similar to the sort that I’m writing here. As far as I’m concerned, I’m most excited about using Sonic Pi to do things I wouldn’t be able to easily do with an acoustic guitar, a mic, a MIDI keyboard and a DAW. 

I can think of certain things that are likely to be easier to accomplish: odd grooves, automating effects, building strange progressions, playing notes that aren’t present on standard keyboards (like what’s between these keys? 🎹) The possibilities seem, well not endless, but finite but large. 

That said, now that I have the basics + arrangement out of the way, step 2 is composition.

#### The (highly highly inefficient) code.
