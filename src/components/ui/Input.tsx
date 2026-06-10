import React, { useId } from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const sizeClasses = {
  sm: 'h-10 text-[var(--text-label-md)] px-3',
  md: 'h-12 text-[var(--text-body-md)] px-4',
  lg: 'h-14 text-[var(--text-body-md)] px-5',
};

const leadingPad = {
  sm: 'pl-9',
  md: 'pl-11',
  lg: 'pl-12',
};

const trailingPad = {
  sm: 'pr-9',
  md: 'pr-11',
  lg: 'pr-12',
};

export const Input: React.FC<InputProps> = ({
  label,
  hint,
  error,
  leadingIcon,
  trailingIcon,
  size = 'md',
  fullWidth = true,
  className = '',
  id: externalId,
  ...props
}) => {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-label-sm text-[var(--color-on-surface-variant)] uppercase tracking-widest"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {leadingIcon && (
          <span
            className="absolute inset-y-0 start-0 flex items-center ps-3.5 text-[var(--color-on-surface-variant)] pointer-events-none z-10"
            style={{ fontSize: '20px' }}
          >
            {leadingIcon}
          </span>
        )}

        <input
          id={id}
          {...props}
          className={[
            'w-full rounded-[var(--radius)]',
            'bg-[var(--color-surface-variant)]',
            'text-[var(--color-on-surface)]',
            'placeholder:text-[var(--color-on-surface-variant)]',
            'border border-transparent',
            // Focus: neon border + soft glow
            'focus:outline-none focus:border-[var(--color-primary-container)]',
            'focus:ring-0',
            'transition-[border-color,box-shadow] duration-200',
            // Error state
            error ? 'border-[var(--color-error)]' : '',
            sizeClasses[size],
            leadingIcon ? leadingPad[size] : '',
            trailingIcon ? trailingPad[size] : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            // Neon glow on focus — done via JS-driven inline style on focus
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(163, 249, 91, 0.2)';
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = '';
            props.onBlur?.(e);
          }}
        />

        {trailingIcon && (
          <span
            className="absolute inset-y-0 end-0 flex items-center pe-3.5 text-[var(--color-on-surface-variant)] pointer-events-none z-10"
            style={{ fontSize: '20px' }}
          >
            {trailingIcon}
          </span>
        )}
      </div>

      {(hint || error) && (
        <p
          className={`text-label-sm ${
            error ? 'text-[var(--color-error)]' : 'text-[var(--color-on-surface-variant)]'
          }`}
          style={{ textTransform: 'none', letterSpacing: '0' }}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
};

// OTP Input — 4-6 digit boxes
interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (val: string) => void;
  error?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  length = 6,
  value,
  onChange,
  error = false,
}) => {
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

  const handleChange = (index: number, char: string) => {
    const newDigits = [...digits];
    newDigits[index] = char.slice(-1).replace(/\D/, '');
    onChange(newDigits.join(''));
    // Auto-focus next
    if (char && index < length - 1) {
      const next = document.getElementById(`otp-${index + 1}`);
      next?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`);
      prev?.focus();
    }
  };

  return (
    <div className="flex gap-3 justify-center" dir="ltr">
      {digits.map((digit, i) => (
        <input
          key={i}
          id={`otp-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={[
            'w-12 h-14 text-center text-headline-sm font-bold',
            'rounded-[var(--radius)]',
            'bg-[var(--color-surface-container)]',
            'text-[var(--color-on-surface)]',
            'border transition-all duration-200',
            'focus:outline-none',
            digit
              ? 'border-[var(--color-primary-container)]'
              : error
              ? 'border-[var(--color-error)]'
              : 'border-[var(--color-outline-variant)]',
          ]
            .filter(Boolean)
            .join(' ')}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(163, 249, 91, 0.25)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = '';
          }}
        />
      ))}
    </div>
  );
};

export default Input;
