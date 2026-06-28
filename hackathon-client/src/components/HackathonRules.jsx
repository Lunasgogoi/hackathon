const ruleSections = [
  {
    title: 'Eligibility',
    items: [
      'Participants must use their own registered account.',
      'Each participant may belong to one team only.',
      'Teams may have up to 6 members.'
    ]
  },
  {
    title: 'Team Conduct',
    items: [
      'All work submitted must be created by the team during the hackathon.',
      'Teams must not share private solutions, repositories, or credentials with other teams.',
      'Respectful communication is required across team, judge, and organizer interactions.'
    ]
  },
  {
    title: 'Assessment',
    items: [
      'Round 1 submissions are final once saved and proceeded.',
      'Automated scoring may include coding challenges and multiple-choice questions.',
      'Teams qualify for the build phase based on the configured cutoff and team average.'
    ]
  },
  {
    title: 'Project Submission',
    items: [
      'Submitted repositories and assets must be accessible to organizers and judges.',
      'External libraries, APIs, and frameworks are allowed unless organizers state otherwise.',
      'Teams are responsible for disclosing major third-party tools used in the project.'
    ]
  },
  {
    title: 'Judging',
    items: [
      'Judges evaluate submissions using the published rubric and live presentation context.',
      'Final standings may remain visible after the hackathon ends.',
      'Organizer decisions are final for tie-breaking, disputes, and eligibility issues.'
    ]
  }
];

export default function HackathonRules() {
  return (
    <div className="mx-auto mt-8 max-w-4xl pb-12">
      <div className="mb-6">
        <div className="text-xs font-bold uppercase text-blue-600">Participant Guide</div>
        <h1 className="text-3xl font-black tracking-tight text-gray-900">Hackathon Rules</h1>
      </div>

      <div className="space-y-4">
        {ruleSections.map((section) => (
          <section key={section.title} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-gray-900">{section.title}</h2>
            <ul className="mt-4 space-y-3 text-sm font-medium leading-6 text-gray-600">
              {section.items.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
