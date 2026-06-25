-- Only inbound (customer) messages should light up the admin bell. Outbound
-- admin replies are inserted into contact_messages for threading and must not
-- notify. Recreate the new-message trigger with a WHEN (inbound) guard.
drop trigger if exists contact_messages_notify_new on public.contact_messages;
create trigger contact_messages_notify_new
  after insert on public.contact_messages
  for each row
  when (new.direction = 'inbound')
  execute function notify_new_message();
