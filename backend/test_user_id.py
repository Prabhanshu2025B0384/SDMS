import asyncio
import httpx
import sys

async def main():
    async with httpx.AsyncClient() as client:
        # 1. Login
        login_res = await client.post("http://localhost:8000/auth/login", data={"username": "admin@gmail.com", "password": "admin"})
        if login_res.status_code != 200:
            print("Login failed")
            sys.exit(1)
            
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get /auth/me
        me_res = await client.get("http://localhost:8000/auth/me", headers=headers)
        me_data = me_res.json()
        print(f"Me ID: {me_data.get('id')}")
        
        # 3. Get /admin/users
        users_res = await client.get("http://localhost:8000/admin/users", headers=headers)
        users_data = users_res.json()
        print(f"Total users: {len(users_data)}")
        first_user_id = users_data[0].get("id")
        print(f"First user ID from list: {first_user_id}")
        
        # 4. Search by ID
        search_res = await client.get(f"http://localhost:8000/admin/users?search={first_user_id}", headers=headers)
        search_data = search_res.json()
        print(f"Search by ID returned {len(search_data)} users")
        if len(search_data) > 0:
            print(f"Search matched user ID: {search_data[0].get('id')}")
            
        # 5. Search by partial ID
        partial_id = first_user_id[:5]
        search_res = await client.get(f"http://localhost:8000/admin/users?search={partial_id}", headers=headers)
        search_data = search_res.json()
        print(f"Search by partial ID ({partial_id}) returned {len(search_data)} users")

if __name__ == "__main__":
    asyncio.run(main())
