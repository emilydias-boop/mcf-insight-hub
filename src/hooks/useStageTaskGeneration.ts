import { supabase } from '@/integrations/supabase/client';
import { addDays } from 'date-fns';

interface TaskFromTemplate {
  deal_id: string;
  template_id: string;
  title: string;
  description: string | null;
  type: 'call' | 'whatsapp' | 'email' | 'meeting' | 'other';
  status: 'pending';
  due_date: string | null;
  owner_id: string | null;
  contact_id: string | null;
}

/**
 * Generates tasks for a deal based on the templates configured for a specific stage
 */
export const generateTasksForStage = async (
  dealId: string,
  newStageId: string,
  originId: string,
  ownerId?: string | null,
  contactId?: string | null
): Promise<{ success: boolean; tasksCreated: number }> => {
  try {
    // 1. Cancel pending tasks from any previous stage
    const { error: cancelError } = await supabase
      .from('deal_tasks')
      .update({ status: 'canceled' })
      .eq('deal_id', dealId)
      .eq('status', 'pending');

    if (cancelError) {
      console.error('Error canceling pending tasks:', cancelError);
    }

    // 2. Fetch activity templates for the new stage
    const { data: templates, error: templatesError } = await supabase
      .from('activity_templates')
      .select('*')
      .eq('stage_id', newStageId)
      .eq('is_active', true)
      .order('order_index');

    if (templatesError) {
      console.error('Error fetching templates:', templatesError);
      return { success: false, tasksCreated: 0 };
    }

    // 3. If no templates found, try without origin filter
    if (!templates || templates.length === 0) {
      console.log(`No templates found for stage ${newStageId}`);
      return { success: true, tasksCreated: 0 };
    }

    // 4. Create tasks from templates
    const now = new Date();
    const tasks: TaskFromTemplate[] = templates.map((template) => {
      const dueDate = template.default_due_days 
        ? addDays(now, template.default_due_days).toISOString()
        : now.toISOString();

      return {
        deal_id: dealId,
        template_id: template.id,
        title: template.name,
        description: template.description,
        type: template.type as TaskFromTemplate['type'],
        status: 'pending',
        due_date: dueDate,
        owner_id: ownerId || null,
        contact_id: contactId || null,
      };
    });

    const { error: insertError } = await supabase
      .from('deal_tasks')
      .insert(tasks);

    if (insertError) {
      console.error('Error creating tasks:', insertError);
      return { success: false, tasksCreated: 0 };
    }

    console.log(`Created ${tasks.length} tasks for deal ${dealId} in stage ${newStageId}`);
    return { success: true, tasksCreated: tasks.length };
  } catch (error) {
    console.error('Error in generateTasksForStage:', error);
    return { success: false, tasksCreated: 0 };
  }
};

/**
 * Check if a stage change occurred and trigger task generation if needed
 */
export const handleStageChange = async (
  dealId: string,
  previousStageId: string | null,
  newStageId: string | null,
  originId: string,
  ownerId?: string | null,
  contactId?: string | null
): Promise<boolean> => {
  // Only generate tasks if stage actually changed and new stage exists
  if (!newStageId || previousStageId === newStageId) {
    return false;
  }

  const result = await generateTasksForStage(
    dealId,
    newStageId,
    originId,
    ownerId,
    contactId
  );

  return result.success;
};
