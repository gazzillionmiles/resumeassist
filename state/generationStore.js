'use client';
import { create } from 'zustand';
export const useGenerationStore = create((set) => ({ result: null, setResult: (result) => set({ result }), clear: () => set({ result: null }) }));
