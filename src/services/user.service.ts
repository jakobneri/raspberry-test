import usersJson from "../../users.json";

export type User = {
  id: string;
  email: string;
  password: string;
};

const userArray: User[] = [];

const data = usersJson as unknown as { users?: User[] } | undefined;

if (data?.users && Array.isArray(data.users)) {
  userArray.push(...data.users);
} else {
  console.error(
    "Fehler beim Laden von users.json: ungültige Struktur oder leer"
  );
}

export { userArray as users };
