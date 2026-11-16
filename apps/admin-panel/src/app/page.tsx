import { redirect } from "next/navigation";

// La dirección principal es para clientes. Los propietarios entran por /panel.
export default function Inicio() {
  redirect("/pedir");
}
