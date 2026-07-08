import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import type { ApiResponse, PantryItem } from "@/types/apiTypes";

/*
  Pantry items tab.
  List all pantry items, add new, delete existing.
  Max 20 items enforced by backend. Show count.
*/
export const PantryTab = () => {
  const queryClient = useQueryClient();
  const [newItem, setNewItem] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["pantry"],
    queryFn: async () => {
      const { data } =
        await api.get<ApiResponse<{ pantry_items: PantryItem[] }>>(
          "/api/pantry",
        );
      return data.data.pantry_items;
    },
    staleTime: 5 * 60 * 1000,
  });

  const addItem = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post<ApiResponse<{ item: PantryItem }>>(
        "/api/pantry",
        { name },
      );
      return data.data.item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
      setNewItem("");
      toast.success("Item added to pantry");
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 400) {
        toast.error("Pantry is full. Maximum 20 items allowed.");
      } else {
        toast.error("Could not add item. Try again.");
      }
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/pantry/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
      toast.success("Item removed");
    },
    onError: () => toast.error("Could not remove item. Try again."),
  });

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (!trimmed || trimmed.length < 2) {
      toast.error("Item name must be at least 2 characters");
      return;
    }
    addItem.mutate(trimmed);
  };

  const items = data ?? [];

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-heading font-bold text-base text-cocoa dark:text-dark-white">
          Pantry items
        </h2>
        <span className="text-xs text-cocoa-faded">{items.length}/20</span>
      </div>

      {/* Add item */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add an ingredient..."
          maxLength={50}
          className="flex-1 bg-transparent border border-cocoa/20
            dark:border-dark-white/20 rounded-xl px-4 py-2.5 text-base lg:text-sm
            text-cocoa dark:text-dark-white outline-none
            focus:border-pawpaw focus:ring-1 focus:ring-pawpaw
            dark:focus:border-black-pawpaw dark:focus:ring-black-pawpaw"
        />
        <button
          onClick={handleAdd}
          disabled={addItem.isPending || items.length >= 20}
          className="px-4 py-2.5 rounded-xl bg-moringa dark:bg-moringa-faded
            text-surface text-sm font-semibold
            hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Skeleton loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 rounded-xl
              bg-cocoa/10 dark:bg-dark-white/10 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Items list */}
      {!isLoading && items.length === 0 && (
        <p className="text-sm text-cocoa-faded text-center py-8">
          Your pantry is empty. Add ingredients to get more personalised spin
          results.
        </p>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between px-4 py-3
              rounded-xl bg-cocoa/5 dark:bg-dark-white/5
              border border-cocoa/5 dark:border-dark-white/5"
          >
            <span className="text-sm text-cocoa dark:text-dark-white capitalize">
              {item.name}
            </span>
            <button
              onClick={() => deleteItem.mutate(item.id)}
              disabled={deleteItem.isPending}
              aria-label={`Remove ${item.name}`}
              className="text-cocoa/30 dark:text-dark-white/30
                hover:text-rose-500 transition-colors disabled:opacity-40"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
