import { z } from 'zod';

/** Rupiah amounts are stored as whole-rupiah integers (no minor unit). */
declare const RupiahSchema: z.ZodNumber;
type Rupiah = z.infer<typeof RupiahSchema>;
declare const CONTRACTS_VERSION: "0.0.0";

declare const LoginInputSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
type LoginInput = z.infer<typeof LoginInputSchema>;
declare const AuthUserSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    id: string;
    name: string;
}, {
    email: string;
    id: string;
    name: string;
}>;
type AuthUser = z.infer<typeof AuthUserSchema>;

type SearchResultType = "account" | "transaction" | "category";
interface SearchResultDto {
    type: SearchResultType;
    id: string;
    label: string;
    sub: string;
    href: string;
    icon: string;
}
interface SearchResponseDto {
    results: SearchResultDto[];
    query: string;
}

declare const AccountTypeSchema: z.ZodEnum<["bank", "ewallet", "cash", "investment", "property"]>;
type AccountType = z.infer<typeof AccountTypeSchema>;
declare const CreateAccountInputSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["bank", "ewallet", "cash", "investment", "property"]>;
    institution: z.ZodOptional<z.ZodString>;
    maskedNumber: z.ZodOptional<z.ZodString>;
    balance: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "bank" | "ewallet" | "cash" | "investment" | "property";
    name: string;
    balance: number;
    currency: string;
    institution?: string | undefined;
    maskedNumber?: string | undefined;
}, {
    type: "bank" | "ewallet" | "cash" | "investment" | "property";
    name: string;
    balance: number;
    institution?: string | undefined;
    maskedNumber?: string | undefined;
    currency?: string | undefined;
}>;
type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;
declare const UpdateAccountInputSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["bank", "ewallet", "cash", "investment", "property"]>>;
    institution: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    maskedNumber: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    balance: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodOptional<z.ZodDefault<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type?: "bank" | "ewallet" | "cash" | "investment" | "property" | undefined;
    name?: string | undefined;
    institution?: string | undefined;
    maskedNumber?: string | undefined;
    balance?: number | undefined;
    currency?: string | undefined;
}, {
    type?: "bank" | "ewallet" | "cash" | "investment" | "property" | undefined;
    name?: string | undefined;
    institution?: string | undefined;
    maskedNumber?: string | undefined;
    balance?: number | undefined;
    currency?: string | undefined;
}>;
type UpdateAccountInput = z.infer<typeof UpdateAccountInputSchema>;
declare const AccountDtoSchema: z.ZodObject<{
    id: z.ZodString;
    familyGroupId: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["bank", "ewallet", "cash", "investment", "property"]>;
    institution: z.ZodNullable<z.ZodString>;
    maskedNumber: z.ZodNullable<z.ZodString>;
    balance: z.ZodString;
    currency: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "bank" | "ewallet" | "cash" | "investment" | "property";
    id: string;
    name: string;
    institution: string | null;
    maskedNumber: string | null;
    balance: string;
    currency: string;
    familyGroupId: string;
    createdAt: string;
    updatedAt: string;
}, {
    type: "bank" | "ewallet" | "cash" | "investment" | "property";
    id: string;
    name: string;
    institution: string | null;
    maskedNumber: string | null;
    balance: string;
    currency: string;
    familyGroupId: string;
    createdAt: string;
    updatedAt: string;
}>;
type AccountDto = z.infer<typeof AccountDtoSchema>;

export { type AccountDto, AccountDtoSchema, type AccountType, AccountTypeSchema, type AuthUser, AuthUserSchema, CONTRACTS_VERSION, type CreateAccountInput, CreateAccountInputSchema, type LoginInput, LoginInputSchema, type Rupiah, RupiahSchema, type SearchResponseDto, type SearchResultDto, type SearchResultType, type UpdateAccountInput, UpdateAccountInputSchema };
