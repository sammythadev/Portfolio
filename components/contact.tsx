"use client";

import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { socialLinks } from "@/data/site";

type FormValues = {
  name: string;
  email: string;
  message: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initialValues: FormValues = { name: "", email: "", message: "" };

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (!values.name.trim()) errors.name = "Please enter your name.";
  else if (values.name.trim().length < 2)
    errors.name = "Name must be at least 2 characters.";

  if (!values.email.trim()) errors.email = "Please enter your email.";
  else if (!EMAIL_PATTERN.test(values.email.trim()))
    errors.email = "Please enter a valid email address.";

  if (!values.message.trim()) errors.message = "Please enter a message.";
  else if (values.message.trim().length < 10)
    errors.message = "Message must be at least 10 characters.";

  return errors;
}

export function Contact() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "sent">("idle");
  const mailtoRef = useRef<HTMLAnchorElement>(null);

  const handleChange = (field: keyof FormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear a field's error as soon as the user starts correcting it.
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validate(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    // No backend is wired up yet, so compose a mailto: draft instead of
    // silently posting nowhere.
    const subject = encodeURIComponent(
      `Portfolio enquiry from ${values.name.trim()}`,
    );
    const body = encodeURIComponent(
      `${values.message.trim()}\n\n—\n${values.name.trim()} <${values.email.trim()}>`,
    );
    const mailto = socialLinks.find((link) =>
      link.href.startsWith("mailto:"),
    )?.href;

    if (mailto) {
      // Hand off to the visitor's mail client via a real anchor click. This
      // keeps the mailto: out of `window.location`, which the Next.js
      // `no-location-assign` rule flags even though it is not an internal route.
      const anchor = mailtoRef.current;
      if (anchor) {
        anchor.href = `${mailto}?subject=${subject}&body=${body}`;
        anchor.click();
      }
    }

    setValues(initialValues);
    setStatus("sent");
  };

  return (
    <section
      id="contact"
      className="scroll-mt-24 bg-surface-muted py-20 sm:py-28"
    >
      <div className="container-page">
        <h2 className="section-title">Get In Touch</h2>

        <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              Let&apos;s build something amazing together
            </h3>
            <p className="mt-4 text-lg text-muted-foreground text-pretty">
              I&apos;m available for freelance work and full-time positions.
            </p>

            <ul className="mt-8 flex flex-col gap-2">
              {socialLinks.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    {...(link.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="group flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-card"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <link.icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs tracking-widest text-muted-foreground uppercase">
                        {link.name}
                      </span>
                      <span className="block truncate font-medium text-foreground">
                        {link.label ?? link.name}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <ContactForm
            values={values}
            errors={errors}
            status={status}
            mailtoRef={mailtoRef}
            onChange={handleChange}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </section>
  );
}

type ContactFormProps = {
  values: FormValues;
  errors: FormErrors;
  status: "idle" | "sent";
  mailtoRef: React.RefObject<HTMLAnchorElement | null>;
  onChange: (field: keyof FormValues, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function ContactForm({
  values,
  errors,
  status,
  mailtoRef,
  onChange,
  onSubmit,
}: ContactFormProps) {
  return (
    <>
      <a ref={mailtoRef} className="sr-only" aria-hidden tabIndex={-1} />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-name">Name</Label>
        <Input
          id="contact-name"
          name="name"
          autoComplete="name"
          placeholder="Your Name"
          value={values.name}
          onChange={(e) => onChange("name", e.target.value)}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "contact-name-error" : undefined}
          className="bg-card"
        />
        {errors.name && (
          <p
            id="contact-name-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {errors.name}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-email">Email</Label>
        <Input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="your@email.com"
          value={values.email}
          onChange={(e) => onChange("email", e.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "contact-email-error" : undefined}
          className="bg-card"
        />
        {errors.email && (
          <p
            id="contact-email-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {errors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          name="message"
          placeholder="Your Message"
          value={values.message}
          onChange={(e) => onChange("message", e.target.value)}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          className="bg-card"
        />
        {errors.message && (
          <p
            id="contact-message-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {errors.message}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="self-start">
        Send Message
      </Button>

      <p
        role="status"
        aria-live="polite"
        className="min-h-5 text-sm text-primary"
      >
        {status === "sent" &&
          "Thanks! Your email client should now be open with the message ready."}
      </p>
    </form>
    </>
  );
}