import { useRef, useState } from "react";
import { Clock3, MapPin, ShieldCheck, Timer } from "lucide-react";
import { Badge, Button, Card, Field } from "@/components/ui-kit";
import { useAppStore } from "@/lib/app-store";

type View = "welcome" | "login" | "signup" | "otp" | "forgot" | "forgot-sent";

export function AuthFlow() {
  const { login, signup } = useAppStore();
  const [view, setView] = useState<View>("welcome");
  const [email, setEmail] = useState("bailey@justintime.app");
  const [phone, setPhone] = useState("+1 (555) 019-4471");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const setDigit = (i: number, v: string) => {
    const digit = v.replace(/\D/g, "").slice(-1);
    setCode((c) => c.map((d, idx) => (idx === i ? digit : d)));
    if (digit && i < 5) inputs.current[i + 1]?.focus();
  };

  const otpComplete = code.every((d) => d !== "");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 px-5 py-10">
      <header className="text-center">
        <Badge tone="primary">Door to gate, perfectly timed</Badge>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">
          Just In <span className="text-primary">Time</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your airport assistant that knows exactly when to leave.
        </p>
      </header>

      {view === "welcome" && (
        <>
          <Card className="space-y-4">
            {[
              { Icon: Timer, t: "Leave-by countdown", d: "Live timer built from real drive, TSA and walk times." },
              { Icon: MapPin, t: "Door-to-gate pipeline", d: "Every leg of your trip estimated and editable." },
              { Icon: ShieldCheck, t: "TSA queue alerts", d: "Know the checkpoint wait before you pack the car." },
              { Icon: Clock3, t: "Journey log", d: "Stamp milestones and learn your personal averages." },
            ].map(({ Icon, t, d }) => (
              <div key={t} className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                  <Icon className="size-5 text-primary" />
                </span>
                <div>
                  <p className="font-display font-semibold">{t}</p>
                  <p className="text-sm text-muted-foreground">{d}</p>
                </div>
              </div>
            ))}
          </Card>
          <div className="space-y-2">
            <Button className="w-full" onClick={() => setView("login")}>
              Log in
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setView("signup")}>
              Sign up
            </Button>
          </div>
        </>
      )}

      {view === "login" && (
        <Card className="space-y-4">
          <h2 className="font-display text-xl font-bold">Welcome back</h2>
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
          <Button
            className="w-full"
            onClick={() => {
              if (!email.includes("@") || password.length < 4) {
                setError("Enter a valid email and a password of 4+ characters.");
                return;
              }
              login(email);
            }}
          >
            Log in
          </Button>
          <div className="flex justify-between text-xs">
            <button className="text-muted-foreground hover:text-foreground" onClick={() => setView("forgot")}>
              Forgot password?
            </button>
            <button className="text-primary" onClick={() => setView("signup")}>
              Create account
            </button>
          </div>
          <Button variant="ghost" className="w-full" onClick={() => login("demo@justintime.app")}>
            Continue as demo traveler
          </Button>
        </Card>
      )}

      {view === "signup" && (
        <Card className="space-y-4">
          <h2 className="font-display text-xl font-bold">Create your account</h2>
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field label="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Field
            label="Password"
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
          <Button
            className="w-full"
            onClick={() => {
              if (!email.includes("@") || phone.length < 6 || password.length < 6) {
                setError("Fill in every field. Passwords need 6+ characters.");
                return;
              }
              setError("");
              setView("otp");
            }}
          >
            Send verification code
          </Button>
          <button className="w-full text-xs text-muted-foreground" onClick={() => setView("login")}>
            Already have an account? Log in
          </button>
        </Card>
      )}

      {view === "otp" && (
        <Card className="space-y-4 text-center">
          <h2 className="font-display text-xl font-bold">Verify your number</h2>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to <span className="text-foreground">{phone}</span>
          </p>
          <div className="flex justify-center gap-2">
            {code.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={d}
                inputMode="numeric"
                aria-label={`Digit ${i + 1}`}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !code[i] && i > 0) inputs.current[i - 1]?.focus();
                }}
                className="size-12 rounded-xl border border-input bg-background/60 text-center font-display text-xl font-bold outline-none focus:border-primary"
              />
            ))}
          </div>
          <Button className="w-full" disabled={!otpComplete} onClick={() => signup(email, phone)}>
            Verify and continue
          </Button>
          <button
            className="w-full text-xs text-muted-foreground"
            onClick={() => setCode(["1", "2", "3", "4", "5", "6"])}
          >
            Autofill demo code
          </button>
        </Card>
      )}

      {view === "forgot" && (
        <Card className="space-y-4">
          <h2 className="font-display text-xl font-bold">Reset your password</h2>
          <p className="text-sm text-muted-foreground">
            We'll email you a secure link to choose a new password.
          </p>
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button className="w-full" onClick={() => setView("forgot-sent")}>
            Send reset link
          </Button>
          <button className="w-full text-xs text-muted-foreground" onClick={() => setView("login")}>
            Back to log in
          </button>
        </Card>
      )}

      {view === "forgot-sent" && (
        <Card className="space-y-4 text-center">
          <Badge tone="success">Email sent</Badge>
          <h2 className="font-display text-xl font-bold">Check your inbox</h2>
          <p className="text-sm text-muted-foreground">
            A reset link is on its way to {email}. It expires in 30 minutes.
          </p>
          <Button className="w-full" onClick={() => setView("login")}>
            Back to log in
          </Button>
        </Card>
      )}

      {view !== "welcome" && (
        <button
          className="text-center text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            setError("");
            setView("welcome");
          }}
        >
          ← Back to welcome
        </button>
      )}
    </div>
  );
}
