"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarIcon } from "lucide-react";

import { Calendar } from "./calendar";
import {
  formatCalendarDate,
  formatCalendarDateInput,
  formatCalendarDateLabel,
  parseCalendarDate,
  parseTypedCalendarDate,
} from "./calendar-date";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "./input-group";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const invalidDateMessage = "Enter a date like June 01, 2025.";
const outOfRangeMessage = "Choose a date in the allowed range.";

interface DateFieldProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function DateField({
  id,
  name,
  value,
  defaultValue = "",
  onChange,
  min,
  max,
  required,
  disabled,
  placeholder = "June 01, 2025",
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const [error, setError] = useState<string | undefined>();
  const committed = value ?? uncontrolled;
  const [draft, setDraft] = useState(() => displayValue(committed));
  const [month, setMonth] = useState<Date | undefined>(() =>
    parseCalendarDate(committed),
  );
  const editing = useRef(false);
  const minDate = min ? parseCalendarDate(min) : undefined;
  const maxDate = max ? parseCalendarDate(max) : undefined;
  const selected = parseCalendarDate(committed);

  useEffect(() => {
    if (editing.current) return;
    setDraft(displayValue(committed));
    const parsed = parseCalendarDate(committed);
    if (parsed) setMonth(parsed);
  }, [committed]);

  function commit(next: string) {
    if (value === undefined) setUncontrolled(next);
    onChange?.(next);
  }

  function outOfRange(date: Date) {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  }

  function applyParsed(date: Date) {
    commit(formatCalendarDate(date));
    setMonth(date);
    setError(undefined);
  }

  function finishEditing(text: string, input?: HTMLInputElement) {
    editing.current = false;
    if (text.trim() === "") {
      input?.setCustomValidity("");
      setError(undefined);
      setDraft("");
      commit("");
      return;
    }

    const parsed = parseTypedCalendarDate(text);
    if (!parsed) {
      input?.setCustomValidity(invalidDateMessage);
      setError(invalidDateMessage);
      return;
    }
    if (outOfRange(parsed)) {
      input?.setCustomValidity(outOfRangeMessage);
      setError(outOfRangeMessage);
      return;
    }

    input?.setCustomValidity("");
    applyParsed(parsed);
    setDraft(formatCalendarDateInput(parsed));
  }

  return (
    <div className="space-y-1">
      <InputGroup>
        <InputGroupInput
          id={id}
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          onFocus={() => {
            editing.current = true;
          }}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            event.currentTarget.setCustomValidity("");
            setError(undefined);
            if (next.trim() === "") {
              commit("");
              return;
            }
            const parsed = parseTypedCalendarDate(next);
            if (!parsed || outOfRange(parsed)) return;
            applyParsed(parsed);
          }}
          onBlur={(event) => {
            const nextFocus = event.relatedTarget;
            if (
              nextFocus instanceof Element &&
              nextFocus.closest(
                "[data-slot=popover-trigger], [data-slot=popover-content]",
              )
            ) {
              return;
            }
            finishEditing(draft, event.currentTarget);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          <Popover
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (next) return;
              const parsed = parseTypedCalendarDate(draft);
              if (!parsed || outOfRange(parsed)) {
                editing.current = false;
                setError(undefined);
                setDraft(displayValue(committed));
                return;
              }
              finishEditing(draft);
            }}
          >
            <PopoverTrigger asChild>
              <InputGroupButton
                variant="ghost"
                size="icon-xs"
                aria-label="Open calendar"
                disabled={disabled}
              >
                <CalendarIcon />
                <span className="sr-only">Open calendar</span>
              </InputGroupButton>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto overflow-hidden p-0"
              align="end"
              alignOffset={-8}
              sideOffset={10}
            >
              <Calendar
                mode="single"
                selected={selected}
                month={month}
                onMonthChange={setMonth}
                onSelect={(date) => {
                  editing.current = false;
                  if (!date) {
                    commit("");
                    setDraft("");
                    setError(undefined);
                    setOpen(false);
                    return;
                  }
                  applyParsed(date);
                  setDraft(formatCalendarDateInput(date));
                  setOpen(false);
                }}
                disabled={(date) => outOfRange(date)}
              />
            </PopoverContent>
          </Popover>
        </InputGroupAddon>
      </InputGroup>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      {name ? <input type="hidden" name={name} value={committed} /> : null}
    </div>
  );
}

function displayValue(value: string) {
  return formatCalendarDateLabel(value);
}
