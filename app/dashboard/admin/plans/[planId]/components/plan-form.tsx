"use client";

import * as z from "zod";
import axios from "axios";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { Trash } from "lucide-react";
import { Plan } from "@prisma/client";
import { useParams, useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Heading } from "@/components/ui/heading";
import { AlertModal } from "@/components/modals/alert-modal";
import { Checkbox } from "@/components/ui/checkbox";

const formSchema = z.object({
  name: z.string().min(1, { message: "Il nome è obbligatorio." }),
  features: z.string().min(1, { message: "Le funzionalità sono obbligatorie." }),
  stripePriceId: z.string().min(1, { message: "L'ID Prezzo di Stripe è obbligatorio." }),
  isActive: z.boolean().optional(),
});

type PlanFormValues = z.infer<typeof formSchema>;

interface PlanFormProps {
  initialData: Plan | null;
}

export const PlanForm: React.FC<PlanFormProps> = ({ initialData }) => {
  const params = useParams();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = initialData ? "Modifica piano" : "Crea piano";
  const description = initialData ? "Modifica un piano esistente." : "Aggiungi un nuovo piano.";
  const toastMessage = initialData ? "Piano aggiornato." : "Piano creato.";
  const action = initialData ? "Salva modifiche" : "Crea";

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
      ? { ...initialData, features: initialData.features.join(','), isActive: !!initialData.isActive }
      : {
          name: '',
          features: '',
          stripePriceId: '',
          isActive: false,
        },
  });

  const onSubmit = async (data: PlanFormValues) => {
    try {
      setLoading(true);
      if (initialData) {
        if (!params) {
          toast.error("ID del piano non trovato.");
          setLoading(false);
          return;
        }
        await axios.patch(`/api/admin/plans/${params.planId}`, data);
      } else {
        await axios.post(`/api/admin/plans`, data);
      }
      router.refresh();
      router.push(`/dashboard/admin/plans`);
      toast.success(toastMessage);
    } catch (error: any) {
      toast.error("Qualcosa è andato storto.");
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    try {
      setLoading(true);
      if (!params) {
        toast.error("ID del piano non trovato.");
        setLoading(false);
        return;
      }
      await axios.delete(`/api/admin/plans/${params.planId}`);
      router.refresh();
      router.push(`/dashboard/admin/plans`);
      toast.success("Piano eliminato.");
    } catch (error: any) {
      toast.error("Qualcosa è andato storto.");
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <>
      <AlertModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={onDelete}
        loading={loading}
      />
      <div className="flex items-center justify-between">
        <Heading title={title} description={description} />
        {initialData && (
          <Button
            disabled={loading}
            variant="destructive"
            size="sm"
            onClick={() => setOpen(true)}
          >
            <Trash className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Separator />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-8 w-full"
        >
          <div className="md:grid md:grid-cols-3 gap-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Es. Piano Base"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stripePriceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID Prezzo Stripe</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Es. price_12345..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="features"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Funzionalità (separate da virgola)</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Es. Funzione 1,Funzione 2"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Attivo
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </div>
          <Button disabled={loading} className="ml-auto" type="submit">
            {action}
          </Button>
        </form>
      </Form>
    </>
  );
};
