/**
 * useProjectPanel - Custom hook for ProjectPanel state management
 * Extracts editing and category expansion logic
 */
import { useState, useCallback } from 'react';
import { AssetLayer } from '../../../types';

export interface UseProjectPanelResult {
    // Editing state
    editingId: string | null;
    editingName: string;
    startEdit: (layer: AssetLayer) => void;
    saveEdit: (onSave: (id: string, name: string) => void) => void;
    cancelEdit: () => void;
    setEditingName: (name: string) => void;

    // Category expansion state
    expandedCategories: Set<string>;
    toggleCategory: (projectId: string, category: string) => void;
    isCategoryExpanded: (projectId: string, category: string) => boolean;
    initializeCategories: (projectIds: string[]) => void;

    // Project creation state
    isCreating: boolean;
    setIsCreating: (creating: boolean) => void;
    newProjectName: string;
    setNewProjectName: (name: string) => void;
}

export function useProjectPanel(): UseProjectPanelResult {
    // Editing state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    // Category expansion state
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    // Project creation state
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    // Editing callbacks
    const startEdit = useCallback((layer: AssetLayer) => {
        setEditingId(layer.id);
        setEditingName(layer.name);
    }, []);

    const saveEdit = useCallback((onSave: (id: string, name: string) => void) => {
        if (!editingId || !editingName.trim()) return;
        onSave(editingId, editingName.trim());
        setEditingId(null);
        setEditingName('');
    }, [editingId, editingName]);

    const cancelEdit = useCallback(() => {
        setEditingId(null);
        setEditingName('');
    }, []);

    // Category callbacks
    const toggleCategory = useCallback((projectId: string, category: string) => {
        const key = `${projectId}-${category}`;
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    }, []);

    const isCategoryExpanded = useCallback((projectId: string, category: string): boolean => {
        const key = `${projectId}-${category}`;
        return expandedCategories.has(key);
    }, [expandedCategories]);

    const initializeCategories = useCallback((projectIds: string[]) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            projectIds.forEach(id => {
                newSet.add(`${id}-data`);
                newSet.add(`${id}-measurements`);
            });
            return newSet;
        });
    }, []);

    return {
        // Editing
        editingId,
        editingName,
        startEdit,
        saveEdit,
        cancelEdit,
        setEditingName,

        // Categories
        expandedCategories,
        toggleCategory,
        isCategoryExpanded,
        initializeCategories,

        // Creation
        isCreating,
        setIsCreating,
        newProjectName,
        setNewProjectName,
    };
}
