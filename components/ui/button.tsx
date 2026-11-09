import {cva,type VariantProps} from 'class-variance-authority';
import {clsx} from 'clsx';
import {twMerge} from 'tailwind-merge';
const variants=cva('inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700',{variants:{variant:{default:'bg-teal-700 text-white hover:bg-teal-800',outline:'border border-slate-200 bg-white hover:bg-slate-50',ghost:'hover:bg-slate-100'}},defaultVariants:{variant:'default'}});
export function Button({className,variant,...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&VariantProps<typeof variants>){return <button className={twMerge(clsx(variants({variant}),className))} {...props}/>}
