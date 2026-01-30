Subject: Dev Diary – OLLM

Intro Thank you for the opportunity to participate in this Hackathon! It was not only a fun experience seeing the community you guys have built, but it was also the first project I’ve ever had to complete against a strict deadline.

My Background: From Technician to "Vibe Coder" I’m not a traditional software developer; I started "vibe coding"—or perhaps "vibe software engineering"—about four months ago. I have an IT background (I was the nerdy kid working in computer shops and IT service companies), but that was 20+ years ago. Since then, my career drifted toward Electrical Engineering, which is my day job here in the UK. IT became just a hobby.

However, AI has heavily influenced my professional workflow recently—not just for creating reports or automating boring tasks, but for actual engineering. My approach evolved naturally: starting with simple n8n automations, moving to website tools, and then discovering Claude Code. That’s when I realized that my 20-year gap in IT didn’t matter anymore. Coding used to be boring to me; now, I have superpowers. I can design and create anything I want, and it actually works! My engineering experience gives me an edge here because I treat AI coding with the same rigorous verification processes I use in my day job.

The App: OLLM For this event, I chose to build OLLM. It started as a small item on my to-do list but grew into a standalone app. I needed OLLM to work as an additional layer—a harness or dynamic prompt router—for my local AI setup.

Essentially, I needed a CLI tool to act as a "middleman" between my other projects and my locally hosted AI (Ollama). It allows for hot-swapping system prompts based on command flags. This means one CLI can work with several different tools, loading specific prompts depending on the request. It centralizes my local AI integration, so I don't have to copy-paste integration code across multiple projects.

OLLM has essentially turned into a terminal-based coding IDE, and I love that. While it’s a terminal app, I added an optional UI layer for better usability. I also tried to make it universal so others can use it for whatever they want, not just as a watchdog for local AI.

The Challenges: Managing the AI Workforce The architecture design for OLLM is solid; the problem was "vibe coding" it into existence.

I treat AI as part of my staff. It’s a brilliant workforce, but it has flaws. Before the Hackathon, I realized that while AI is great at coding, it requires a dedicated workflow: Problem > Solution > Plan > Design > Implement > Verify. You cannot treat AI as a black box. Because of context limits and "permanent amnesia," keeping design documentation up-to-date is crucial. You have to actively participate. Even though I can't write a "Hello World" script from scratch, I can read the code and understand the logic to guide the AI.

Simple apps (like an insult generator) are easy for AI. But on a complex codebase with parallel logic chains, AI can be terrible, lazy, and reckless. If I don't feed it the right documentation, fixing one bug breaks three other things. It often leaves legacy code or dead imports behind. If you aren't careful, you end up with "parallel universes" of logic within one system, and the app eventually collapses. A human in the loop is required to guard the logic like a watchdog.

The "Crisis" & Kiro I have my own tools for vibe coding, but using Kiro for this event was great. The Kiro Spec build tool (requirements, design, tasks) really helped keep the AI under control.

However, the biggest challenge was the core feature: Session Snapshots and Context Window Control.

The app allows users to select a model and a context size (since models range from 4k to 128k). This creates a lot of moving parts. The system has to pass hardware info and model selection to the prompt builder, then send it to Ollama via the ctx parameter. Since Ollama has no memory of previous messages, I had to design a system to create context summaries and snapshots. This prevents the LLM from hallucinating or forgetting the "plot" during long conversations.

The design was good, but the implementation was a nightmare. During debugging, the AI drifted from the design. We patched the session rollovers, but the system became unstable. Just yesterday—one day before submission—I ran an audit and realized the code was a mess. Claude confirmed it was a "mix-mash" of conflicting logic chains.

The Crunch I had to do a full rework of one of the most complex parts of the core system the day before the deadline. I spent most of today testing, verifying, and debugging. It was stressful, but we made it. Through sweat, tears, and a swarm of AI agents, the app is working... kind of.

Because I had to split my focus between making the app function and making it look good enough for the demo, many planned features had to be pushed back. However, I have documented a full roadmap for the next few months.

OLLM may have been born as a prototype for this Hackathon, but this is just the beginning. Over the next few weeks, my priority is improving core stability and squashing the bugs I found. Once the foundation is solid, I’ll start rolling out the new features I have planned.

Who knows? Maybe among the participants or the community, I’ll find people who resonate with this idea and want to contribute. That would be awesome.


Conclusion AI Vibe coding is interesting and opens up endless possibilities, but right now, it is also frustrating and full of flaws. However, I can clearly see that in the future, this will be seamless and part of our day-to-day lives.

Thanks again, take care, and good luck to all the participants in this event!
