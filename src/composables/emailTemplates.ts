/**
 * Built-in email templates.
 *
 * A template body is only the middle of the email: the greeting
 * ("Dear {recipient},") and sign-off ("Best regards, <name>") are added by the
 * Email tool according to the chosen tone. Placeholders are `{key}`, where key
 * is one of the template's `fields` (or the shared `recipient`).
 */

export type Tone = 'formal' | 'friendly' | 'short'

export const TONES: { value: Tone; label: string }[] = [
  { value: 'formal', label: 'Formal' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'short', label: 'Short' },
]

export interface EmailField {
  key: string
  label: string
  placeholder?: string
  /** `date` shows a date picker and is written out as "Thursday, 20 November 2026". */
  type?: 'text' | 'textarea' | 'date'
}

export interface EmailDraft {
  subject: string
  body: string
}

export interface EmailTemplate {
  id: string
  name: string
  description: string
  fields: EmailField[]
  variants: Record<Tone, EmailDraft>
  /** Greeting per tone when the email isn't addressed to one person. */
  greeting?: Record<Tone, string>
  /** Saved by the user (editable / deletable). */
  custom?: boolean
  /** Custom templates can opt out of the automatic greeting and sign-off. */
  wrap?: boolean
}

export const GREETINGS: Record<Tone, string> = {
  formal: 'Dear {recipient},',
  friendly: 'Hi {recipient},',
  short: 'Hi {recipient},',
}

export const SIGN_OFFS: Record<Tone, string> = {
  formal: 'Best regards,',
  friendly: 'Kind regards,',
  short: 'Thanks,',
}

export const BUILT_IN_TEMPLATES: EmailTemplate[] = [
  {
    id: 'leave',
    name: 'Leave request',
    description: 'Ask your manager for time off',
    fields: [
      { key: 'dates', label: 'Leave dates', placeholder: '20–21 November 2026' },
      { key: 'reason', label: 'Reason', placeholder: 'a family event' },
      { key: 'cover', label: 'Who covers for you', placeholder: 'Sophea' },
    ],
    variants: {
      formal: {
        subject: 'Leave Request: {dates}',
        body:
          'I would like to request leave on {dates} due to {reason}.\n\n' +
          'During my absence, {cover} has agreed to handle any urgent matters, and I will make sure my current tasks are up to date before I leave.\n\n' +
          'Please let me know if you need any further information. Thank you for considering my request.',
      },
      friendly: {
        subject: 'Time off request – {dates}',
        body:
          "I'd like to take some time off on {dates} for {reason}.\n\n" +
          "{cover} has kindly agreed to cover for me while I'm away, and I'll wrap up my current work before I go.\n\n" +
          'Let me know if that works for you. Thanks so much!',
      },
      short: {
        subject: 'Leave: {dates}',
        body:
          'I would like to request leave on {dates} ({reason}). {cover} will cover urgent items while I am out.\n\n' +
          'Please confirm if this is approved.',
      },
    },
  },
  {
    id: 'meeting',
    name: 'Meeting request',
    description: 'Invite someone to meet or call',
    fields: [
      { key: 'topic', label: 'Topic', placeholder: 'the Q1 budget plan' },
      { key: 'time', label: 'Proposed time', placeholder: 'Tuesday, 25 November at 10:00 AM' },
      { key: 'duration', label: 'Duration', placeholder: '30 minutes' },
      { key: 'location', label: 'Location / link', placeholder: 'Meeting Room 2 or Microsoft Teams' },
    ],
    variants: {
      formal: {
        subject: 'Meeting Request: {topic}',
        body:
          'I would like to schedule a meeting to discuss {topic}.\n\n' +
          'Would {time} be convenient for you? The meeting should take about {duration} and can be held at {location}.\n\n' +
          'If this time does not suit you, please let me know a time that works better and I will be happy to adjust.',
      },
      friendly: {
        subject: 'Quick chat about {topic}?',
        body:
          "I'd love to find some time to talk about {topic}.\n\n" +
          'Are you free {time}? It should only take about {duration}, and we can meet at {location}.\n\n' +
          "If that doesn't work, just suggest another time. Looking forward to it!",
      },
      short: {
        subject: 'Meeting: {topic} – {time}',
        body:
          'Can we meet {time} ({duration}) at {location} to discuss {topic}?\n\n' +
          'Please confirm or suggest another time.',
      },
    },
  },
  {
    id: 'follow-up',
    name: 'Follow-up',
    description: 'Check in after a meeting or a request',
    fields: [
      { key: 'topic', label: 'Topic', placeholder: 'the vendor contract' },
      { key: 'when', label: 'When you last spoke', placeholder: 'last Friday' },
      { key: 'next', label: 'What you need next', placeholder: 'the signed copy of the agreement' },
    ],
    variants: {
      formal: {
        subject: 'Follow-up: {topic}',
        body:
          'I am writing to follow up on our discussion {when} regarding {topic}.\n\n' +
          'Could you please provide an update on {next}? This will help us move forward with the next steps.\n\n' +
          'Thank you for your time, and please let me know if there is anything I can do to assist.',
      },
      friendly: {
        subject: 'Following up on {topic}',
        body:
          'Just following up on our chat {when} about {topic}.\n\n' +
          'Do you have any update on {next}? No rush, I just want to make sure we keep things moving.\n\n' +
          'Thanks a lot!',
      },
      short: {
        subject: 'Follow-up: {topic}',
        body: 'Following up on {topic} from {when}. Any update on {next}?',
      },
    },
  },
  {
    id: 'thanks',
    name: 'Thank you',
    description: 'Show appreciation for help or support',
    fields: [
      { key: 'reason', label: 'Thank them for', placeholder: 'your help with the system migration' },
      { key: 'impact', label: 'What it made possible', placeholder: 'we finished two days ahead of schedule' },
    ],
    variants: {
      formal: {
        subject: 'Thank You',
        body:
          'I would like to sincerely thank you for {reason}.\n\n' +
          'Thanks to your support, {impact}. Your effort is truly appreciated.\n\n' +
          'I look forward to working with you again.',
      },
      friendly: {
        subject: 'Thank you so much!',
        body:
          'A big thank you for {reason}!\n\n' +
          'Because of you, {impact}. I really appreciate it.\n\n' +
          'Let me know if I can ever return the favour.',
      },
      short: {
        subject: 'Thanks!',
        body: 'Thank you for {reason}. Because of it, {impact}. Much appreciated.',
      },
    },
  },
  {
    id: 'delay',
    name: 'Apology / delay',
    description: 'Apologise for a delay and give a new date',
    fields: [
      { key: 'item', label: 'What is delayed', placeholder: 'the monthly report' },
      { key: 'reason', label: 'Reason', placeholder: 'a data issue we found during review' },
      { key: 'newDate', label: 'New delivery date', type: 'date' },
    ],
    variants: {
      formal: {
        subject: 'Apology for the Delay: {item}',
        body:
          'Please accept my apologies for the delay in delivering {item}. This was caused by {reason}.\n\n' +
          'We are working to resolve this and expect to deliver it by {newDate}. I will keep you informed of any changes.\n\n' +
          'Thank you for your patience and understanding.',
      },
      friendly: {
        subject: 'Sorry – {item} is running late',
        body:
          "I'm sorry, {item} is going to be a bit late. We ran into {reason}.\n\n" +
          "We're on it and you should have it by {newDate}. I'll let you know if anything changes.\n\n" +
          'Thanks for bearing with us!',
      },
      short: {
        subject: 'Delay: {item} – new date {newDate}',
        body: 'Apologies, {item} is delayed due to {reason}. New expected date: {newDate}.',
      },
    },
  },
  {
    id: 'reminder',
    name: 'Reminder',
    description: 'Politely remind someone of a deadline',
    fields: [
      { key: 'item', label: 'What is due', placeholder: 'the expense report for October' },
      { key: 'due', label: 'Due date', type: 'date' },
      { key: 'action', label: 'What they need to do', placeholder: 'submit it through the finance portal' },
    ],
    variants: {
      formal: {
        subject: 'Reminder: {item} due {due}',
        body:
          'This is a kind reminder that {item} is due on {due}.\n\n' +
          'Please {action} before the deadline. If you have already done so, kindly disregard this message.\n\n' +
          'Thank you for your cooperation.',
      },
      friendly: {
        subject: 'Friendly reminder: {item}',
        body:
          'Just a quick reminder that {item} is due on {due}.\n\n' +
          "When you get a chance, please {action}. If it's already done, thank you and please ignore this!",
      },
      short: {
        subject: 'Reminder: {item} – {due}',
        body: 'Reminder: {item} is due {due}. Please {action}.',
      },
    },
  },
  {
    id: 'intro',
    name: 'Introduction',
    description: 'Introduce yourself to a new contact',
    fields: [
      { key: 'role', label: 'Your role / team', placeholder: 'a developer on the Digital Banking team' },
      { key: 'purpose', label: 'Why you are reaching out', placeholder: 'we will be working together on the new mobile app' },
      { key: 'ask', label: 'Next step you propose', placeholder: 'a short call this week to get to know each other' },
    ],
    variants: {
      formal: {
        subject: 'Introduction',
        body:
          'Allow me to introduce myself. I am {role}, and I am reaching out because {purpose}.\n\n' +
          'I would welcome the opportunity for {ask}. Please let me know what suits your schedule.\n\n' +
          'I look forward to working with you.',
      },
      friendly: {
        subject: 'Nice to meet you!',
        body:
          "I'm {role}, and I wanted to say hello because {purpose}.\n\n" +
          'Would you be up for {ask}? Let me know what works for you.\n\n' +
          'Looking forward to working together!',
      },
      short: {
        subject: 'Introduction – {role}',
        body: "Hi, I'm {role}. Reaching out because {purpose}. Open to {ask}?",
      },
    },
  },
  {
    id: 'info',
    name: 'Request information',
    description: 'Ask for documents, data or details',
    fields: [
      { key: 'topic', label: 'Topic', placeholder: 'the loan application for ABC Co., Ltd.' },
      { key: 'details', label: 'Information needed', type: 'textarea', placeholder: '- Latest financial statement\n- Business license copy' },
      { key: 'deadline', label: 'Needed by', type: 'date' },
    ],
    variants: {
      formal: {
        subject: 'Request for Information: {topic}',
        body:
          'I am writing to request some information regarding {topic}. Could you please provide the following:\n\n' +
          '{details}\n\n' +
          'It would be greatly appreciated if you could send this by {deadline}. Please do not hesitate to contact me if you have any questions.',
      },
      friendly: {
        subject: 'Could you send me some info on {topic}?',
        body:
          "I'm working on {topic} and could use a few things from you:\n\n" +
          '{details}\n\n' +
          'Would it be possible to send them by {deadline}? Thanks in advance!',
      },
      short: {
        subject: 'Info needed: {topic} (by {deadline})',
        body: 'For {topic}, please send:\n\n{details}\n\nNeeded by {deadline}.',
      },
    },
  },
  {
    id: 'approval',
    name: 'Approval request',
    description: 'Ask a manager to approve something',
    fields: [
      { key: 'item', label: 'What needs approval', placeholder: 'the purchase of 5 new laptops' },
      { key: 'details', label: 'Key details', type: 'textarea', placeholder: 'Total cost: $4,500\nVendor: XYZ Computer\nBudget: IT 2026' },
      { key: 'deadline', label: 'Decision needed by', type: 'date' },
    ],
    variants: {
      formal: {
        subject: 'Approval Request: {item}',
        body:
          'I would like to request your approval for {item}. Please find the key details below:\n\n' +
          '{details}\n\n' +
          'Your approval by {deadline} would allow us to proceed on schedule. Please let me know if you require any additional information.',
      },
      friendly: {
        subject: 'Approval needed: {item}',
        body:
          'Could you take a look and approve {item}? Here are the details:\n\n' +
          '{details}\n\n' +
          "If possible, I'd need the go-ahead by {deadline}. Happy to answer any questions!",
      },
      short: {
        subject: 'Approval: {item} (by {deadline})',
        body: 'Please approve {item}.\n\n{details}\n\nNeeded by {deadline}.',
      },
    },
  },
  {
    id: 'ooo',
    name: 'Out of office',
    description: 'Auto-reply while you are away',
    fields: [
      { key: 'start', label: 'Away from', type: 'date' },
      { key: 'end', label: 'Back on', type: 'date' },
      { key: 'contact', label: 'Backup contact', placeholder: 'Sophea (sophea@example.com)' },
    ],
    greeting: { formal: 'Hello,', friendly: 'Hi there,', short: 'Hi,' },
    variants: {
      formal: {
        subject: 'Out of Office: {start} – {end}',
        body:
          'Thank you for your email. I am currently out of the office from {start} and will return on {end}, with limited access to email.\n\n' +
          'For urgent matters, please contact {contact}. Otherwise, I will respond to your message as soon as possible upon my return.',
      },
      friendly: {
        subject: 'Away until {end}',
        body:
          "Thanks for your message! I'm away from {start} and back on {end}.\n\n" +
          "If it's urgent, {contact} can help. Otherwise I'll get back to you when I return.",
      },
      short: {
        subject: 'OOO until {end}',
        body: 'Out of office {start} – {end}. Urgent: {contact}.',
      },
    },
  },
]
