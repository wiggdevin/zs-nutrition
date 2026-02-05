"use client";

import { notFound } from 'next/navigation'
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-store";

export default function TestFeature450Page() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  const [inputValue, setInputValue] = useState("");
  const [selectValue, setSelectValue] = useState("option1");
  const [textAreaValue, setTextAreaValue] = useState("");
  const [checkboxValue, setCheckboxValue] = useState(false);
  const [radioValue, setRadioValue] = useState("radio1");
  const [modalOpen, setModalOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-12">
        {/* Header */}
        <div className="border-b border-border pb-6">
          <h1 className="font-heading text-4xl uppercase text-foreground">
            Feature #450: shadcn/ui Dark Theme Verification
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Testing all base UI components render correctly with dark theme
          </p>
        </div>

        {/* Buttons Section */}
        <section className="space-y-4">
          <h2 className="section-label text-primary">1. Button Components</h2>
          <p className="text-sm text-muted-foreground">
            Verify all button variants render with correct dark theme styling
          </p>

          <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-card p-6">
            <Button variant="default">Default Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="destructive">Destructive Button</Button>
            <Button variant="link">Link Button</Button>
            <Button variant="default" size="sm">
              Small Button
            </Button>
            <Button variant="default" size="lg">
              Large Button
            </Button>
            <Button variant="outline" disabled>
              Disabled Button
            </Button>
          </div>

          <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4">
            <p className="text-sm text-green-500 font-medium">
              ✓ Verification: Buttons should have dark backgrounds, proper contrast,
              and orange (#f97316) primary color
            </p>
          </div>
        </section>

        {/* Input Fields Section */}
        <section className="space-y-4">
          <h2 className="section-label text-primary">2. Input Fields</h2>
          <p className="text-sm text-muted-foreground">
            Verify input fields have dark backgrounds and subtle borders
          </p>

          <div className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div>
              <label
                htmlFor="test-text-input"
                className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
              >
                Text Input
              </label>
              <input
                id="test-text-input"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter text here..."
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder-[#a1a1aa]/50 outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
              />
            </div>

            <div>
              <label
                htmlFor="test-email-input"
                className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
              >
                Email Input
              </label>
              <input
                id="test-email-input"
                type="email"
                placeholder="email@example.com"
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder-[#a1a1aa]/50 outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
              />
            </div>

            <div>
              <label
                htmlFor="test-number-input"
                className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
              >
                Number Input
              </label>
              <input
                id="test-number-input"
                type="number"
                placeholder="123"
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder-[#a1a1aa]/50 outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
              />
            </div>

            <div>
              <label
                htmlFor="test-password-input"
                className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
              >
                Password Input
              </label>
              <input
                id="test-password-input"
                type="password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder-[#a1a1aa]/50 outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
              />
            </div>

            <div>
              <label
                htmlFor="test-textarea"
                className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
              >
                Textarea
              </label>
              <textarea
                id="test-textarea"
                value={textAreaValue}
                onChange={(e) => setTextAreaValue(e.target.value)}
                placeholder="Enter multi-line text..."
                rows={4}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder-[#a1a1aa]/50 outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] resize-y"
              />
            </div>
          </div>

          <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4">
            <p className="text-sm text-green-500 font-medium">
              ✓ Verification: Inputs should have dark background (#1e1e1e), subtle
              border (#2a2a2a), and orange focus ring
            </p>
          </div>
        </section>

        {/* Select/Dropdown Section */}
        <section className="space-y-4">
          <h2 className="section-label text-primary">
            3. Select/Dropdown Components
          </h2>
          <p className="text-sm text-muted-foreground">
            Verify select dropdowns work with dark theme
          </p>

          <div className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div>
              <label
                htmlFor="test-select"
                className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
              >
                Select Dropdown
              </label>
              <select
                id="test-select"
                value={selectValue}
                onChange={(e) => setSelectValue(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
              >
                <option value="option1">Option 1</option>
                <option value="option2">Option 2</option>
                <option value="option3">Option 3</option>
                <option value="option4">Option 4</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="test-select-disabled"
                className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground"
              >
                Disabled Select
              </label>
              <select
                id="test-select-disabled"
                disabled
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-muted-foreground opacity-50 outline-none transition-colors"
              >
                <option>Cannot select</option>
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4">
            <p className="text-sm text-green-500 font-medium">
              ✓ Verification: Select should have dark styling, dropdown options
              visible, proper contrast
            </p>
          </div>
        </section>

        {/* Checkbox & Radio Section */}
        <section className="space-y-4">
          <h2 className="section-label text-primary">
            4. Checkbox & Radio Components
          </h2>
          <p className="text-sm text-muted-foreground">
            Verify checkbox and radio buttons render correctly
          </p>

          <div className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <input
                id="test-checkbox"
                type="checkbox"
                checked={checkboxValue}
                onChange={(e) => setCheckboxValue(e.target.checked)}
                className="h-5 w-5 rounded border-border bg-card text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
              />
              <label
                htmlFor="test-checkbox"
                className="cursor-pointer text-sm text-foreground"
              >
                Checkbox Option
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="test-checkbox-disabled"
                type="checkbox"
                disabled
                className="h-5 w-5 rounded border-border bg-card text-primary opacity-50"
              />
              <label
                htmlFor="test-checkbox-disabled"
                className="cursor-not-allowed text-sm text-muted-foreground"
              >
                Disabled Checkbox
              </label>
            </div>

            <div className="space-y-3">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Radio Options:
              </p>
              <div className="flex items-center gap-3">
                <input
                  id="test-radio-1"
                  name="test-radio"
                  type="radio"
                  value="radio1"
                  checked={radioValue === "radio1"}
                  onChange={(e) => setRadioValue(e.target.value)}
                  className="h-5 w-5 border-border bg-card text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
                />
                <label
                  htmlFor="test-radio-1"
                  className="cursor-pointer text-sm text-foreground"
                >
                  Radio Option 1
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="test-radio-2"
                  name="test-radio"
                  type="radio"
                  value="radio2"
                  checked={radioValue === "radio2"}
                  onChange={(e) => setRadioValue(e.target.value)}
                  className="h-5 w-5 border-border bg-card text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
                />
                <label
                  htmlFor="test-radio-2"
                  className="cursor-pointer text-sm text-foreground"
                >
                  Radio Option 2
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4">
            <p className="text-sm text-green-500 font-medium">
              ✓ Verification: Checkboxes and radios should have visible borders,
              checked state shows orange color
            </p>
          </div>
        </section>

        {/* Dialog/Modal Section */}
        <section className="space-y-4">
          <h2 className="section-label text-primary">
            5. Dialog/Modal Components
          </h2>
          <p className="text-sm text-muted-foreground">
            Verify modal dialogs render with dark overlay and content
          </p>

          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
              <Button variant="outline" onClick={() => setDialogOpen(true)}>
                Open Dialog
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4">
            <p className="text-sm text-green-500 font-medium">
              ✓ Verification: Modals should have dark overlay, dark content
              background, proper contrast
            </p>
          </div>
        </section>

        {/* Toast Section */}
        <section className="space-y-4">
          <h2 className="section-label text-primary">6. Toast Components</h2>
          <p className="text-sm text-muted-foreground">
            Verify toast notifications render with dark theme
          </p>

          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  toast.success("Success message with dark theme!")
                }
              >
                Success Toast
              </Button>
              <Button
                variant="outline"
                onClick={() => toast.error("Error message with dark theme!")}
              >
                Error Toast
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast.warning("Warning message with dark theme!")
                }
              >
                Warning Toast
              </Button>
              <Button
                variant="outline"
                onClick={() => toast.info("Info message with dark theme!")}
              >
                Info Toast
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4">
            <p className="text-sm text-green-500 font-medium">
              ✓ Verification: Toasts should have semi-transparent dark
              background, colored borders, proper text contrast
            </p>
          </div>
        </section>

        {/* Overall Theme Verification */}
        <section className="space-y-4">
          <h2 className="section-label text-primary">
            7. Overall Theme Verification
          </h2>
          <p className="text-sm text-muted-foreground">
            All components should be themed to dark palette
          </p>

          <div className="rounded-lg border border-border bg-card p-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <p className="font-mono text-xs text-muted-foreground">Background</p>
                <div className="h-12 rounded border border-border bg-background" />
                <p className="text-xs text-muted-foreground">#0a0a0a</p>
              </div>
              <div className="space-y-2">
                <p className="font-mono text-xs text-muted-foreground">Card</p>
                <div className="h-12 rounded border border-border bg-card" />
                <p className="text-xs text-muted-foreground">#1a1a1a</p>
              </div>
              <div className="space-y-2">
                <p className="font-mono text-xs text-muted-foreground">Input</p>
                <div className="h-12 rounded border border-border bg-card" />
                <p className="text-xs text-muted-foreground">#1e1e1e</p>
              </div>
              <div className="space-y-2">
                <p className="font-mono text-xs text-muted-foreground">Primary</p>
                <div className="h-12 rounded border border-border bg-primary" />
                <p className="text-xs text-muted-foreground">#f97316</p>
              </div>
              <div className="space-y-2">
                <p className="font-mono text-xs text-muted-foreground">Border</p>
                <div className="h-12 rounded border border-border bg-muted" />
                <p className="text-xs text-muted-foreground">#2a2a2a</p>
              </div>
              <div className="space-y-2">
                <p className="font-mono text-xs text-muted-foreground">Foreground</p>
                <div className="h-12 rounded border border-border bg-foreground" />
                <p className="text-xs text-muted-foreground">#fafafa</p>
              </div>
              <div className="space-y-2">
                <p className="font-mono text-xs text-muted-foreground">Muted</p>
                <div className="h-12 rounded border border-border bg-muted" />
                <p className="text-xs text-muted-foreground">#27272a</p>
              </div>
              <div className="space-y-2">
                <p className="font-mono text-xs text-muted-foreground">Muted FG</p>
                <div className="h-12 rounded border border-border bg-muted-foreground" />
                <p className="text-xs text-muted-foreground">#a1a1aa</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4">
            <p className="text-sm text-green-500 font-medium">
              ✓ Verification: All color tokens match dark theme specification in
              globals.css
            </p>
          </div>
        </section>

        {/* Test Instructions */}
        <section className="rounded-lg border border-border bg-card p-6">
          <h3 className="font-heading text-xl uppercase text-foreground">
            Manual Test Instructions
          </h3>
          <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              1. Verify all buttons have correct hover states and focus rings
            </li>
            <li>
              2. Type in input fields - verify dark background and orange focus
              ring
            </li>
            <li>
              3. Click select dropdown - verify options are visible and readable
            </li>
            <li>4. Check checkboxes and radios - verify checked state</li>
            <li>
              5. Click modal buttons - verify overlay and content are dark themed
            </li>
            <li>
              6. Click toast buttons - verify all 4 toast types render correctly
            </li>
            <li>
              7. Verify no light backgrounds or text contrast issues anywhere
            </li>
          </ol>
        </section>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-8"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-xl border border-border bg-background shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-2xl uppercase text-foreground">
              Modal Title
            </h3>
            <p className="mt-4 text-sm text-muted-foreground">
              This is a modal dialog. It should have a dark overlay and dark
              content background with proper contrast.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setModalOpen(false)}>Confirm</Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-8"
          onClick={() => setDialogOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-xl border border-border bg-background shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-xl uppercase text-foreground">
              Dialog Title
            </h3>
            <p className="mt-4 text-sm text-muted-foreground">
              This is a dialog. Similar to modal but typically used for confirmations
              and alerts.
            </p>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setDialogOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
